import { describe, expect, it } from "vitest";
import { apiPermissionPattern, apiProblemOf, isAllowedApiUrl, normalizeApiUrl } from "./remote-api";

describe("remote API URL policy", () => {
  it("accepts an HTTPS origin and canonicalizes a trailing slash", () => {
    expect(normalizeApiUrl(" https://api.example.com/ ")).toBe("https://api.example.com");
  });

  it("allows plain HTTP only for loopback development servers", () => {
    expect(normalizeApiUrl("http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000");
    expect(normalizeApiUrl("http://localhost:8000/")).toBe("http://localhost:8000");
    expect(isAllowedApiUrl("http://api.example.com")).toBe(false);
  });

  it("rejects credentials, query strings, fragments, paths, and non-HTTP schemes", () => {
    expect(isAllowedApiUrl("https://user:pass@api.example.com")).toBe(false);
    expect(isAllowedApiUrl("https://api.example.com?token=secret")).toBe(false);
    expect(isAllowedApiUrl("https://api.example.com/#fragment")).toBe(false);
    expect(isAllowedApiUrl("https://api.example.com/v1")).toBe(false);
    expect(isAllowedApiUrl("file:///tmp/api")).toBe(false);
  });

  it("requests permission for the exact host rather than all hosts", () => {
    expect(apiPermissionPattern("https://api.example.com:8443/")).toBe("https://api.example.com/*");
  });
});

describe("API URL error codes", () => {
  function problemFor(raw: string): string | null {
    try {
      normalizeApiUrl(raw);
      return null;
    } catch (error) {
      return apiProblemOf(error);
    }
  }

  it("maps each rejection to a stable code", () => {
    expect(problemFor("gopher://api.example.com")).toBe("scheme");
    expect(problemFor("https://user:pass@api.example.com")).toBe("credentials");
    expect(problemFor("https://api.example.com?token=secret")).toBe("query");
    expect(problemFor("https://api.example.com/v1")).toBe("path");
    expect(problemFor("http://api.example.com")).toBe("https");
    expect(problemFor("https://api.example.com/")).toBe(null);
  });

  it("returns null for non-API errors", () => {
    expect(apiProblemOf(new Error("boom"))).toBe(null);
    expect(apiProblemOf("boom")).toBe(null);
  });
});
