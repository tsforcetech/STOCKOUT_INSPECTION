import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "@/test/http";
import { tokenStore } from "../token-store";
import { loadCurrentIdentity } from "../current-identity";

afterEach(() => vi.unstubAllGlobals());

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const profile = { userId: "u-1", displayName: "Ada Admin", firstName: "Ada", lastName: "Admin", preferredLocale: null, timeZone: null, profileImageAssetId: null, createdAtUtc: "", updatedAtUtc: "" };

describe("loadCurrentIdentity", () => {
  it("uses /identity/me when it works", async () => {
    mockFetch([{ method: "GET", path: "/api/v1/identity/me", respond: () => ({ body: { userId: "u-1", email: "a@b.c", displayName: "From identity" } }) }]);
    const me = await loadCurrentIdentity(async () => profile);
    expect(me.displayName).toBe("From identity");
  });

  it("falls back to the profile and token claims when identity-access returns 404", async () => {
    tokenStore.set(`h.${b64({ sub: "u-1", email: "ada@stockout.test", email_verified: true, auth_time: 1761400000 })}.s`, "rt", 900);
    mockFetch([{ method: "GET", path: "/api/v1/identity/me", respond: () => ({ status: 404, body: { detail: "User identity not found." } }) }]);
    const me = await loadCurrentIdentity(async () => profile);
    expect(me).toMatchObject({ userId: "u-1", email: "ada@stockout.test", emailVerified: true, displayName: "Ada Admin", status: "Active" });
    expect(me.authTime).toBe(new Date(1761400000 * 1000).toISOString());
  });

  it("does not hide other failures", async () => {
    mockFetch([{ method: "GET", path: "/api/v1/identity/me", respond: () => ({ status: 500, body: {} }) }]);
    await expect(loadCurrentIdentity(async () => profile)).rejects.toBeTruthy();
  });
});
