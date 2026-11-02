import { describe, expect, it } from "vitest";
import { buildAccessContext, satisfies } from "../permissions";

describe("permissions", () => {
  const ctx = buildAccessContext(["Roles.View", "sellers.view"], ["PlatformAdmin"]);
  it("is case-insensitive like the backend", () => {
    expect(satisfies(ctx, "roles.view")).toBe(true);
  });
  it("supports anyOf / allOf / role", () => {
    expect(satisfies(ctx, { anyOf: ["x", "sellers.view"] })).toBe(true);
    expect(satisfies(ctx, { allOf: ["roles.view", "roles.assign"] })).toBe(false);
    expect(satisfies(ctx, { role: "PlatformAdmin" })).toBe(true);
    expect(satisfies(ctx, { role: "PlatformSuperAdmin" })).toBe(false);
  });
  it("allows when no requirement is given", () => {
    expect(satisfies(buildAccessContext([], []), undefined)).toBe(true);
  });
});
