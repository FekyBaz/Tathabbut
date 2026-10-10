const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeApiUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const parsed = new URL(value);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("API URL must use HTTP or HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("API URL must not contain credentials.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("API URL must not contain a query string or fragment.");
  }
  if (parsed.protocol === "http:" && !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Non-local API URLs must use HTTPS.");
  }
  return parsed.href.replace(/\/+$/, "");
}

export function apiPermissionPattern(raw: string): string {
  const normalized = normalizeApiUrl(raw);
  if (!normalized) throw new Error("API URL is empty.");
  const parsed = new URL(normalized);
  return parsed.protocol + "//" + parsed.hostname + "/*";
}

export function isAllowedApiUrl(raw: string): boolean {
  try {
    normalizeApiUrl(raw);
    return Boolean(raw.trim());
  } catch {
    return false;
  }
}
