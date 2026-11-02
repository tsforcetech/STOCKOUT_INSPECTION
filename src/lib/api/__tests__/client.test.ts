import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAuthHandlers, http, buildUrl } from "../client";
import { tokenStore } from "@/lib/auth/token-store";
import { mockFetch } from "@/test/http";
import { ApiError } from "../errors";

describe("http client", () => {
  beforeEach(() => {
    tokenStore.clear();
  });
  afterEach(() => {
    configureAuthHandlers(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("builds query strings and skips empty values", () => {
    expect(buildUrl("/api/v1/x", { a: 1, b: "", c: undefined, d: ["p", "q"] })).toBe("/api/v1/x?a=1&d=p&d=q");
  });

  it("attaches the bearer token and correlation id", async () => {
    tokenStore.set("access-1", "refresh-1", 900);
    const { calls } = mockFetch([{ method: "GET", path: "/api/v1/users/me", respond: () => ({ body: { success: true, data: {} } }) }]);
    await http.get("/api/v1/users/me");
    expect(calls[0].headers.get("Authorization")).toBe("Bearer access-1");
    expect(calls[0].headers.get("X-Correlation-Id")).toMatch(/[0-9a-f-]{36}/);
  });

  it("does not attach a token for auth:false requests", async () => {
    tokenStore.set("access-1", "refresh-1", 900);
    const { calls } = mockFetch([{ method: "POST", path: "/api/v1/auth/login", respond: () => ({ body: {} }) }]);
    await http.post("/api/v1/auth/login", { a: 1 }, { auth: false });
    expect(calls[0].headers.get("Authorization")).toBeNull();
  });

  it("refreshes once for concurrent 401s, then retries each request", async () => {
    tokenStore.set("old", "refresh-1", 900);
    let refreshes = 0;
    const refresh = vi.fn(async () => {
      refreshes += 1;
      await new Promise((r) => setTimeout(r, 10));
      tokenStore.set("new", "refresh-2", 900);
      return true;
    });
    configureAuthHandlers({ refresh, onSessionExpired: vi.fn() });
    mockFetch([
      {
        method: "GET",
        path: /\/api\/v1\/platform\/.*/,
        respond: ({ init }) => (new Headers(init.headers).get("Authorization") === "Bearer new" ? { body: { success: true, data: 1 } } : { status: 401 }),
      },
    ]);
    const results = await Promise.all([http.get("/api/v1/platform/a"), http.get("/api/v1/platform/b"), http.get("/api/v1/platform/c")]);
    expect(refreshes).toBe(1);
    expect(results).toHaveLength(3);
  });

  it("signals session expiry when refresh fails", async () => {
    tokenStore.set("old", "refresh-1", 900);
    const onSessionExpired = vi.fn();
    configureAuthHandlers({ refresh: async () => false, onSessionExpired });
    mockFetch([{ method: "GET", path: "/api/v1/platform/users", respond: () => ({ status: 401 }) }]);
    await expect(http.get("/api/v1/platform/users")).rejects.toMatchObject({ kind: "unauthorized" });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("treats gateway 403 forbidden_access as a possibly revoked session", async () => {
    tokenStore.set("old", "refresh-1", 900);
    const onSessionExpired = vi.fn();
    configureAuthHandlers({ refresh: async () => false, onSessionExpired });
    mockFetch([{ method: "GET", path: "/api/v1/platform/users", respond: () => ({ status: 403, body: { title: "Forbidden", status: 403, code: "forbidden_access" } }) }]);
    await expect(http.get("/api/v1/platform/users")).rejects.toMatchObject({ kind: "forbidden" });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("does NOT sign out on a service-level permission 403", async () => {
    tokenStore.set("old", "refresh-1", 900);
    const onSessionExpired = vi.fn();
    const refresh = vi.fn(async () => true);
    configureAuthHandlers({ refresh, onSessionExpired });
    mockFetch([{ method: "GET", path: "/api/v1/platform/roles", respond: () => ({ status: 403, body: { error: "FORBIDDEN", message: "No." } }) }]);
    await expect(http.get("/api/v1/platform/roles")).rejects.toMatchObject({ kind: "forbidden", message: "No." });
    expect(refresh).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("maps network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const error = await http.get("/api/v1/x", { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("network");
  });

  it("times out slow requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))),
    );
    await expect(http.get("/api/v1/slow", { auth: false, timeoutMs: 20 })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("parses JSON error bodies into ApiError", async () => {
    mockFetch([{ method: "PUT", path: "/api/v1/platform/settings/k", respond: () => ({ status: 409, body: { error: "VERSION_CONFLICT", message: "Version conflict." } }) }]);
    await expect(http.put("/api/v1/platform/settings/k", { value: "1", expectedVersion: 1 }, { auth: false })).rejects.toMatchObject({
      kind: "conflict",
      code: "VERSION_CONFLICT",
      status: 409,
    });
  });
});
