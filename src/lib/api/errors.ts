/**
 * Normalised API error. The backend returns different error bodies per service:
 *  - identity-access: RFC 7807 ProblemDetails ({ type, title, status, detail, errors?, code? ... })
 *  - user-organization / catalog-listing / inventory-media / notification-integration: { error, message }
 *  - gateway: plain status codes (401/403/429/502/504) with small or empty bodies
 * `parseErrorBody` turns any of them into one shape so screens never branch on the service.
 */
export type ApiErrorKind =
  | "network"
  | "timeout"
  | "aborted"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "server"
  | "unavailable"
  | "http";

export type FieldErrors = Record<string, string[]>;

export interface ApiErrorInit {
  kind: ApiErrorKind;
  status: number;
  message: string;
  code?: string;
  fieldErrors?: FieldErrors;
  requestId?: string;
  retryAfterSeconds?: number;
  body?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors: FieldErrors;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly body?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
    this.requestId = init.requestId;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.body = init.body;
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Converts "Email", "request.Email", "$.email", "Items[0].Name" to the camelCase path used by forms. */
export function normaliseFieldName(field: string): string {
  const cleaned = field.replace(/^\$\.?/, "").replace(/^(request|req|command|dto|model)\./i, "");
  return cleaned
    .split(".")
    .map((segment) => (segment ? segment.charAt(0).toLowerCase() + segment.slice(1) : segment))
    .join(".");
}

function collectFieldErrors(raw: unknown): FieldErrors | undefined {
  if (isRecord(raw)) {
    const result: FieldErrors = {};
    for (const [key, value] of Object.entries(raw)) {
      const messages = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : typeof value === "string"
          ? [value]
          : [];
      if (messages.length) result[normaliseFieldName(key)] = messages;
    }
    return Object.keys(result).length ? result : undefined;
  }
  if (Array.isArray(raw)) {
    // [{ field|propertyName, message|errorMessage }]
    const result: FieldErrors = {};
    for (const item of raw) {
      if (!isRecord(item)) continue;
      const field = str(item.field) ?? str(item.propertyName) ?? str(item.name);
      const message = str(item.message) ?? str(item.errorMessage) ?? str(item.error);
      if (field && message) (result[normaliseFieldName(field)] ??= []).push(message);
    }
    return Object.keys(result).length ? result : undefined;
  }
  return undefined;
}

export interface ParsedErrorBody {
  message?: string;
  code?: string;
  fieldErrors?: FieldErrors;
}

export function parseErrorBody(body: unknown): ParsedErrorBody {
  if (typeof body === "string") return { message: str(body) && body.length < 300 ? body : undefined };
  if (!isRecord(body)) return {};

  // { success:false, error:{ code, message } } or { error: { ... } }
  if (isRecord(body.error)) {
    const inner = parseErrorBody(body.error);
    return { ...inner, message: inner.message ?? str(body.message) };
  }

  const code = str(body.code) ?? str(body.errorCode) ?? str(body.error);
  const message = str(body.detail) ?? str(body.message) ?? str(body.title);
  const fieldErrors = collectFieldErrors(body.errors) ?? collectFieldErrors(body.validationErrors);

  // ProblemDetails "title" is often generic ("One or more validation errors occurred.") — fine as fallback.
  return {
    code: code && /^[A-Z0-9_.:-]+$/i.test(code) && !code.includes(" ") ? code : undefined,
    message: message ?? (code && code.includes(" ") ? code : undefined),
    fieldErrors,
  };
}

function kindForStatus(status: number, hasFieldErrors: boolean): ApiErrorKind {
  if (status === 400 || status === 422) return hasFieldErrors || status === 422 ? "validation" : "http";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 503 || status === 504) return "unavailable";
  if (status >= 500) return "server";
  return "http";
}

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  network: "Could not reach the server. Check your connection and try again.",
  timeout: "The server took too long to respond. Please try again.",
  aborted: "The request was cancelled.",
  unauthorized: "Your session has expired. Please sign in again.",
  forbidden: "You don't have permission to perform this action.",
  not_found: "The requested record was not found.",
  conflict: "This record was changed or conflicts with existing data. Refresh and try again.",
  validation: "Some fields are invalid. Please review the highlighted fields.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  server: "The server encountered an error. Please try again later.",
  unavailable: "The service is temporarily unavailable. Please try again shortly.",
  http: "The request could not be completed.",
};

export function defaultMessageFor(kind: ApiErrorKind): string {
  return DEFAULT_MESSAGES[kind];
}

export function apiErrorFromResponse(
  status: number,
  body: unknown,
  headers: { requestId?: string; retryAfter?: string | null },
): ApiError {
  const parsed = parseErrorBody(body);
  const kind = kindForStatus(status, Boolean(parsed.fieldErrors));
  const retryAfter = headers.retryAfter ? Number.parseInt(headers.retryAfter, 10) : undefined;
  // Never surface raw server stack traces / internal messages for 5xx.
  const message = status >= 500 ? DEFAULT_MESSAGES[kind] : (parsed.message ?? DEFAULT_MESSAGES[kind]);
  return new ApiError({
    kind,
    status,
    message,
    code: parsed.code,
    fieldErrors: parsed.fieldErrors,
    requestId: headers.requestId,
    retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
    body,
  });
}

/** User-facing message for any thrown value. */
export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.kind === "rate_limited" && error.retryAfterSeconds) {
      return `Too many requests. Please try again in ${error.retryAfterSeconds} seconds.`;
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}
