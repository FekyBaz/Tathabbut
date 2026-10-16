export type ApiUrlProblem =
  | "scheme"
  | "credentials"
  | "query"
  | "path"
  | "https";

export class ApiUrlError extends Error {
  readonly problem: ApiUrlProblem;
  constructor(problem: ApiUrlProblem, message: string) {
    super(message);
    this.problem = problem;
  }
}

export function apiProblemOf(error: unknown): ApiUrlProblem | null {
  return error instanceof ApiUrlError ? error.problem : null;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeApiUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const parsed = new URL(value);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new ApiUrlError("scheme", "API URL must use HTTP or HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new ApiUrlError("credentials", "API URL must not contain credentials.");
  }
  if (parsed.search || parsed.hash) {
    throw new ApiUrlError("query", "API URL must not contain a query string or fragment.");
  }
  if (parsed.pathname !== "/") {
    throw new ApiUrlError("path", "Enter the API origin only; /v1/classify is appended automatically.");
  }
  if (parsed.protocol === "http:" && !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new ApiUrlError("https", "Non-local API URLs must use HTTPS.");
  }
  return parsed.origin;
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
