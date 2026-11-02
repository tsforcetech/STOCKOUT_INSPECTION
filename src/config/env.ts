function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const env = {
  /** Gateway origin. Empty string means same-origin `/api` (dev proxy or reverse proxy). */
  apiBaseUrl: trimTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? ""),
  refreshTokenStorage: (import.meta.env.VITE_REFRESH_TOKEN_STORAGE === "session" ? "session" : "local") as
    | "local"
    | "session",
  /** Public marketplace (buyer site), where people create a StockOut account before accepting an invitation. */
  marketplaceUrl: trimTrailingSlash(import.meta.env.VITE_MARKETPLACE_URL || "https://tsforcetech.github.io/STOCKOUT_BUYER"),
  requestTimeoutMs: 30_000,
  isDev: import.meta.env.DEV,
} as const;
