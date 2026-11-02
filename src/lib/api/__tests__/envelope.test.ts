import { describe, expect, it } from "vitest";
import { unwrapData } from "../envelope";

describe("unwrapData", () => {
  it("unwraps { success, data }", () => {
    expect(unwrapData({ success: true, data: [1, 2] })).toEqual([1, 2]);
  });
  it("unwraps files { data }", () => {
    expect(unwrapData({ data: { fileId: "f" } })).toEqual({ fileId: "f" });
  });
  it("passes through bare DTOs that happen to contain a data field among others", () => {
    const dto = { data: 1, totalCount: 3 };
    expect(unwrapData(dto)).toBe(dto);
  });
  it("throws on success:false", () => {
    expect(() => unwrapData({ success: false, data: null, message: "nope" })).toThrow("nope");
  });
});
