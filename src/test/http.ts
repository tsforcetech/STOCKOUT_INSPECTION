import { vi } from "vitest";

export interface MockRoute {
  method: string;
  path: string | RegExp;
  respond: (req: { url: URL; init: RequestInit; body: unknown }) => { status?: number; body?: unknown; headers?: Record<string, string> } | Promise<{ status?: number; body?: unknown; headers?: Record<string, string> }>;
}

/** Minimal fetch mock that routes by method + path and records calls. */
export function mockFetch(routes: MockRoute[]) {
  const calls: Array<{ method: string; url: URL; headers: Headers; body: unknown }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://localhost");
    const method = (init.method ?? "GET").toUpperCase();
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : init.body;
    calls.push({ method, url, headers: new Headers(init.headers), body });
    const route = routes.find((r) => r.method === method && (typeof r.path === "string" ? r.path === url.pathname : r.path.test(url.pathname)));
    if (!route) return new Response(JSON.stringify({ error: "NO_MOCK", message: `${method} ${url.pathname}` }), { status: 599 });
    const res = await route.respond({ url, init, body });
    const status = res.status ?? 200;
    return new Response(res.body === undefined || status === 204 ? null : JSON.stringify(res.body), {
      status,
      headers: { "content-type": "application/json", ...res.headers },
    });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}
