import { describe, expect, it } from "vitest";
import { apiErrorFromResponse, getErrorMessage, normaliseFieldName, parseErrorBody } from "../errors";

describe("parseErrorBody", () => {
  it("reads user-organization / catalog { error, message }", () => {
    expect(parseErrorBody({ error: "ROLE_NOT_FOUND", message: null })).toEqual({ code: "ROLE_NOT_FOUND", message: undefined, fieldErrors: undefined });
    expect(parseErrorBody({ error: "FORBIDDEN", message: "You do not have permission to view roles." }).message).toBe("You do not have permission to view roles.");
  });

  it("reads inventory-media { errorCode, message }", () => {
    expect(parseErrorBody({ errorCode: "FILE_SIZE_EXCEEDED", message: "Too big" })).toMatchObject({ code: "FILE_SIZE_EXCEEDED", message: "Too big" });
  });

  it("reads identity ProblemDetails (detail preferred over title)", () => {
    const parsed = parseErrorBody({ type: "https://emcore.platform/errors/403", title: "Account Locked", status: 403, detail: "Account is temporarily locked." });
    expect(parsed.message).toBe("Account is temporarily locked.");
  });

  it("reads gateway problem+json with lowercase code", () => {
    expect(parseErrorBody({ title: "Forbidden", status: 403, detail: "x", code: "forbidden_access" }).code).toBe("forbidden_access");
  });

  it("maps ASP.NET ValidationProblemDetails PascalCase keys to camelCase fields", () => {
    const parsed = parseErrorBody({ title: "One or more validation errors occurred.", status: 400, errors: { Email: ["The Email field is required."], "$.roleCodes": ["bad"] } });
    expect(parsed.fieldErrors).toEqual({ email: ["The Email field is required."], roleCodes: ["bad"] });
  });

  it("returns empty for non-objects", () => {
    expect(parseErrorBody(undefined)).toEqual({});
    expect(parseErrorBody("<html>")).toEqual({ message: "<html>" });
  });
});

describe("apiErrorFromResponse", () => {
  it("classifies by status", () => {
    expect(apiErrorFromResponse(401, undefined, {}).kind).toBe("unauthorized");
    expect(apiErrorFromResponse(403, { error: "FORBIDDEN" }, {}).kind).toBe("forbidden");
    expect(apiErrorFromResponse(404, undefined, {}).kind).toBe("not_found");
    expect(apiErrorFromResponse(409, { error: "VERSION_CONFLICT" }, {}).kind).toBe("conflict");
    expect(apiErrorFromResponse(400, { errors: { Name: ["x"] } }, {}).kind).toBe("validation");
    expect(apiErrorFromResponse(503, undefined, {}).kind).toBe("unavailable");
  });

  it("never exposes raw server messages for 5xx", () => {
    const err = apiErrorFromResponse(500, { detail: "SqlException: Timeout at Server=db01" }, {});
    expect(err.message).not.toContain("SqlException");
    expect(err.kind).toBe("server");
  });

  it("captures Retry-After and request id", () => {
    const err = apiErrorFromResponse(429, { code: "rate_limit_exceeded" }, { retryAfter: "42", requestId: "req-1" });
    expect(err.retryAfterSeconds).toBe(42);
    expect(err.requestId).toBe("req-1");
    expect(getErrorMessage(err)).toContain("42 seconds");
  });
});

describe("normaliseFieldName", () => {
  it("handles prefixes and nested paths", () => {
    expect(normaliseFieldName("request.DisplayName")).toBe("displayName");
    expect(normaliseFieldName("Invitations[0].Email")).toBe("invitations[0].email");
  });
});
