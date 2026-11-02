import { describe, expect, it } from "vitest";
import { toCsv } from "../csv";
import { formatBytes, humanize } from "../format";

describe("toCsv", () => {
  it("escapes quotes, commas and newlines", () => {
    const csv = toCsv([{ a: 'He said "hi", ok', b: "line1\nline2" }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv).toBe('A,B\r\n"He said ""hi"", ok","line1\nline2"');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(toCsv([{ a: "=HYPERLINK(1)" }], [{ header: "A", value: (r) => r.a }])).toBe("A\r\n'=HYPERLINK(1)");
  });
});

describe("format helpers", () => {
  it("humanizes backend enum values", () => {
    expect(humanize("UNDER_REVIEW")).toBe("Under review");
    expect(humanize("PendingVerification")).toBe("Pending verification");
  });
  it("formats bytes", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("date parsing", () => {
  it("treats offset-less backend timestamps as UTC and unset .NET dates as missing", async () => {
    const { formatDateTime } = await import("../format");
    const a = formatDateTime("2026-10-17T10:00:00.1234567");
    const b = formatDateTime(new Date(Date.UTC(2026, 9, 17, 10, 0, 0)));
    expect(a).toBe(b);
    expect(formatDateTime("0001-01-01T00:00:00")).toBe("—");
  });
});
