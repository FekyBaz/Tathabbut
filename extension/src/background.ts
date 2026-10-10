import { apiPermissionPattern, normalizeApiUrl } from "./remote-api";
import { isUsableRemoteClassification, type Category, type Classification } from "./policy";

const ALLOWED_CATEGORIES = new Set<Category>(["harassment", "hate", "threats", "spam"]);

interface RemoteRequest {
  type: "tathabbut:classify-remote";
  apiUrl: string;
  text: string;
  enabledCategories: Category[];
}

function isRemoteRequest(value: unknown): value is RemoteRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RemoteRequest>;
  return candidate.type === "tathabbut:classify-remote" &&
    typeof candidate.apiUrl === "string" &&
    typeof candidate.text === "string" &&
    candidate.text.length > 0 &&
    candidate.text.length <= 4000 &&
    Array.isArray(candidate.enabledCategories) &&
    candidate.enabledCategories.every((category) => ALLOWED_CATEGORIES.has(category));
}

async function classifyRemotely(request: RemoteRequest): Promise<Classification | null> {
  let apiUrl: string;
  let permissionPattern: string;
  try {
    apiUrl = normalizeApiUrl(request.apiUrl);
    permissionPattern = apiPermissionPattern(apiUrl);
  } catch {
    return null;
  }

  const permitted = await chrome.permissions.contains({ origins: [permissionPattern] });
  if (!permitted) return null;

  try {
    const response = await fetch(apiUrl + "/v1/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: request.text,
        enabled_categories: request.enabledCategories
      }),
      signal: AbortSignal.timeout(5000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store"
    });
    if (!response.ok) return null;
    const result: unknown = await response.json();
    return isUsableRemoteClassification(result) ? result : null;
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isRemoteRequest(message)) return;
  void classifyRemotely(message)
    .then((result) => sendResponse({ ok: result !== null, result }))
    .catch(() => sendResponse({ ok: false, result: null }));
  return true;
});
