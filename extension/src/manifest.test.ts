import { describe, expect, it } from "vitest";
import manifest from "../manifest.json";

/**
 * Guards the Facebook host scope: the extension must inject on every
 * facebook.com host users actually open (www, web, m, bare apex) and on
 * nothing else. A www-only pattern silently disables the extension on
 * web.facebook.com / m.facebook.com, which was a real-world failure mode.
 *
 * The matcher below mirrors Chromium match-pattern semantics for the
 * https-only patterns this project uses: `*.host` covers all subdomains,
 * and the apex needs its own explicit pattern.
 */
function matchesPattern(url: string, pattern: string): boolean {
  const parsed = new URL(url);
  const body = pattern.replace(/^https:\/\//, "").replace(/\/\*$/, "");
  if (!pattern.startsWith("https://") || !pattern.endsWith("/*")) return false;
  if (parsed.protocol !== "https:") return false;
  if (body.startsWith("*.")) {
    const suffix = body.slice(1);
    return parsed.hostname === suffix.slice(1) || parsed.hostname.endsWith(suffix);
  }
  return parsed.hostname === body;
}

function contentMatches(): string[] {
  const scripts = (manifest as { content_scripts?: Array<{ matches?: string[] }> }).content_scripts ?? [];
  return scripts.flatMap((entry) => entry.matches ?? []);
}

function hostPermissions(): string[] {
  return (manifest as { host_permissions?: string[] }).host_permissions ?? [];
}

describe("manifest host scope", () => {
  it("stays https-only with no broad patterns", () => {
    for (const pattern of [...contentMatches(), ...hostPermissions()]) {
      expect(pattern.startsWith("https://")).toBe(true);
      expect(pattern).not.toContain("<all_urls>");
      expect(pattern).not.toMatch(/^https?:\/\/\*\//);
    }
  });

  it("covers every facebook.com entry point users open", () => {
    const patterns = contentMatches();
    const cases: Array<[string, boolean]> = [
      ["https://www.facebook.com/", true],
      ["https://web.facebook.com/", true],
      ["https://m.facebook.com/", true],
      ["https://facebook.com/", true],
      ["https://www.facebook.com/groups/feed/", true],
      ["http://www.facebook.com/", false],
      ["https://evilfacebook.com/", false],
      ["https://facebook.com.attacker.example/", false],
      ["https://notfacebook.com/", false],
      ["https://www.example.com/", false],
      ["https://facebook.com.evil.com/", false],
      ["https://www.notfacebook.com/", false]
    ];
    for (const [url, expected] of cases) {
      expect(
        patterns.some((pattern) => matchesPattern(url, pattern)),
        url
      ).toBe(expected);
    }
  });

  it("keeps host permissions aligned with injection matches", () => {
    const matches = contentMatches();
    for (const pattern of matches) {
      expect(hostPermissions()).toContain(pattern);
    }
    expect(hostPermissions().length).toBeGreaterThan(0);
  });
});
