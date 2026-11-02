import { describe, expect, it } from "vitest";
import { FILE_LIMITS, isAllowedFileType } from "@/services/files.service";

/** Mirrors FileAssetService._policies + RequestUploadAsync (inventory-media FileAssetService.cs:30-60). */
describe("isAllowedFileType", () => {
  it("requires both an allowed MIME type and an allowed extension", () => {
    expect(isAllowedFileType({ name: "photo.JPG", type: "image/jpeg" }, "USER_PROFILE_PHOTO")).toBe(true);
    expect(isAllowedFileType({ name: "photo.jfif", type: "image/jpeg" }, "USER_PROFILE_PHOTO")).toBe(false);
    expect(isAllowedFileType({ name: "photo", type: "image/jpeg" }, "USER_PROFILE_PHOTO")).toBe(false);
    expect(isAllowedFileType({ name: "scan.pdf", type: "application/pdf" }, "USER_PROFILE_PHOTO")).toBe(false);
  });

  it("matches the inspection evidence policy", () => {
    expect(isAllowedFileType({ name: "report.pdf", type: "application/pdf" }, "INSPECTION_EVIDENCE")).toBe(true);
    expect(isAllowedFileType({ name: "shot.webp", type: "image/webp" }, "INSPECTION_EVIDENCE")).toBe(true);
    expect(isAllowedFileType({ name: "notes.txt", type: "text/plain" }, "INSPECTION_EVIDENCE")).toBe(false);
  });

  it("does not allow arbitrary types for attachments", () => {
    expect(FILE_LIMITS.GENERAL_ATTACHMENT.accept).not.toContain("*/*");
    expect(isAllowedFileType({ name: "a.zip", type: "application/zip" }, "CHAT_ATTACHMENT")).toBe(false);
    expect(isAllowedFileType({ name: "a.webp", type: "image/webp" }, "RETURN_EVIDENCE")).toBe(true);
  });
});
