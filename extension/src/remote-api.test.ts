import { describe, expect, it } from "vitest";
import { apiPermissionPattern, isAllowedApiUrl, normalizeApiUrl } from "./remote-api";

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
