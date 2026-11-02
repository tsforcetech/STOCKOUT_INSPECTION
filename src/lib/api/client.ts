import { env } from "@/config/env";
import { tokenStore } from "@/lib/auth/token-store";
import { newId } from "@/lib/utils/id";
import { ApiError, apiErrorFromResponse, defaultMessageFor } from "./errors";

export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number | boolean>;
export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Attach the bearer token and handle 401 refresh (default true). */
  auth?: boolean;
  timeoutMs?: number;
  /** Sent as X-Idempotency-Key. Required by some mutations (e.g. seller listing create/update). */
  idempotencyKey?: string;
  /** Sent as X-StepUp-Token for operations that require recent re-authentication. */
  stepUpToken?: string;
  responseType?: "json" | "blob" | "text";
}

interface AuthHandlers {
  /** Exchanges the refresh token. Resolves true when a fresh access token is available. */
  refresh: () => Promise<boolean>;
  /** Called when the session can no longer be recovered (refresh failed / no refresh token). */
  onSessionExpired: () => void;
}

let authHandlers: AuthHandlers | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function configureAuthHandlers(handlers: AuthHandlers | null): void {
  authHandlers = handlers;
}

/** Single-flight refresh: concurrent 401s share one refresh request. */
export function refreshSession(): Promise<boolean> {
  if (!authHandlers) return Promise.resolve(false);
  if (!refreshInFlight) {
    const handlers = authHandlers;
    refreshInFlight = handlers
      .refresh()
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export function buildUrl(path: string, query?: QueryParams): string {
  const base = /^https?:\/\//.test(path) ? path : `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBody(response: Response, responseType: RequestOptions["responseType"]): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  if (responseType === "blob") return response.blob();
  const text = await response.text();
  if (!text) return undefined;
  if (responseType === "text") return text;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") || /^[[{]/.test(text.trim())) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

function combineSignals(timeoutMs: number, external?: AbortSignal): { signal: AbortSignal; didTimeout: () => boolean; cleanup: () => void } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

async function send(method: string, path: string, options: RequestOptions, isRetry: boolean): Promise<unknown> {
  const useAuth = options.auth !== false;

  if (useAuth && authHandlers && tokenStore.isAccessTokenExpired() && tokenStore.getPersistedRefreshToken()) {
    await refreshSession();
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Correlation-Id": newId(),
    ...options.headers,
  };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData || options.body instanceof Blob) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (useAuth) {
    const token = tokenStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey;
  if (options.stepUpToken) headers["X-StepUp-Token"] = options.stepUpToken;

  const { signal, didTimeout, cleanup } = combineSignals(options.timeoutMs ?? env.requestTimeoutMs, options.signal);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), { method, headers, body, signal, credentials: "same-origin" });
  } catch (error) {
    cleanup();
    if (didTimeout()) throw new ApiError({ kind: "timeout", status: 0, message: defaultMessageFor("timeout") });
    if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new ApiError({ kind: "aborted", status: 0, message: defaultMessageFor("aborted") });
    }
    throw new ApiError({ kind: "network", status: 0, message: defaultMessageFor("network") });
  }

  let parsed: unknown;
  try {
    parsed = await readBody(response, response.ok ? options.responseType : "json");
  } catch {
    parsed = undefined;
  } finally {
    cleanup();
  }

  // The gateway answers 403 `forbidden_access` (rather than 401) when the token is valid but its
  // session was revoked server-side. Try one refresh: a revoked session cannot refresh, so the user
  // is signed out; if refresh works and the retry is still 403 it is a genuine permission denial.
  const gatewaySessionDenied = response.status === 403 && isRecord(parsed) && parsed.code === "forbidden_access";

  if ((response.status === 401 || gatewaySessionDenied) && useAuth && authHandlers) {
    if (!isRetry && tokenStore.getPersistedRefreshToken()) {
      const refreshed = await refreshSession();
      if (refreshed) return send(method, path, options, true);
      authHandlers.onSessionExpired();
    } else if (response.status === 401) {
      authHandlers.onSessionExpired();
    }
  }

  if (!response.ok) {
    throw apiErrorFromResponse(response.status, parsed, {
      requestId: response.headers.get("X-Request-Id") ?? response.headers.get("X-Correlation-Id") ?? undefined,
      retryAfter: response.headers.get("Retry-After"),
    });
  }
  return parsed;
}

export const http = {
  request: <T = unknown>(method: string, path: string, options: RequestOptions = {}) =>
    send(method, path, options, false) as Promise<T>,
  get: <T = unknown>(path: string, options?: RequestOptions) => http.request<T>("GET", path, options),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => http.request<T>("POST", path, { ...options, body }),
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => http.request<T>("PUT", path, { ...options, body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => http.request<T>("PATCH", path, { ...options, body }),
  delete: <T = unknown>(path: string, options?: RequestOptions) => http.request<T>("DELETE", path, options),
};
