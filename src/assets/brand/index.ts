/**
 * Brand raster assets exported from Figma (see docs/FIGMA_IMPLEMENTATION.md). Resolved at build time:
 * when a file is not present the corresponding URL is undefined and components render their fallback.
 */
const files = import.meta.glob<string>("./*.{png,svg,webp,jpg}", { eager: true, query: "?url", import: "default" });

/** Official logo from the Stockout Brand Guidelines (V1.0, July 2026): black wordmark for light backgrounds, white for dark. */
export const brandLogoUrl: string | undefined = files["./stockout-logo.svg"];
export const brandLogoWhiteUrl: string | undefined = files["./stockout-logo-white.svg"];
/** The folded-arrow "O" icon on its own (favicon, compact spots). */
export const brandMarkUrl: string | undefined = files["./stockout-mark.svg"];
export const loginHeroUrl: string | undefined = files["./login-hero.png"] ?? files["./login-hero.webp"];
