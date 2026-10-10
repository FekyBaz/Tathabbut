import { DEFAULT_SETTINGS, classifyLocally, isUsableRemoteClassification, shouldHide, type Classification, type UserSettings } from "./policy";

const HIDDEN_CLASS = "tathabbut-hidden";
const MAX_TEXT_LENGTH = 4000;
let settings: UserSettings = { ...DEFAULT_SETTINGS, enabledCategories: [...DEFAULT_SETTINGS.enabledCategories] };
const processed = new WeakSet<Element>();

function readText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
}
function candidates(): Element[] {
  return Array.from(document.querySelectorAll('[role="article"]')).filter((el) => el instanceof HTMLElement);
}
async function classify(text: string): Promise<Classification> {
  const localResult = classifyLocally(text);
  if (!settings.apiUrl) return localResult;
  try {
    const response = await fetch(settings.apiUrl.replace(/\/$/, "") + "/v1/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, enabled_categories: settings.enabledCategories }),
      signal: AbortSignal.timeout(5000),
      credentials: "omit",
      referrerPolicy: "no-referrer"
    });
    if (!response.ok) return localResult;
    const remote: unknown = await response.json();
    return isUsableRemoteClassification(remote) ? remote : localResult;
  } catch {
    return localResult;
  }
}
function reveal(element: Element): void {
  element.classList.remove(HIDDEN_CLASS);
  element.removeAttribute("data-tathabbut-hidden");
  element.querySelectorAll(":scope > .tathabbut-reveal").forEach((button) => button.remove());
}
async function evaluate(element: Element): Promise<void> {
  if (processed.has(element)) return;
  processed.add(element);
  const text = readText(element);
  if (!text) return;
  const result = await classify(text);
  if (!element.isConnected || !shouldHide(result, settings)) return;
  element.classList.add(HIDDEN_CLASS);
  element.setAttribute("data-tathabbut-hidden", "true");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tathabbut-reveal";
  button.textContent = "Tathabbut: reveal hidden content";
  button.setAttribute("aria-label", "Reveal content hidden by Tathabbut");
  button.addEventListener("click", () => reveal(element), { once: true });
  element.prepend(button);
}
function scan(): void {
  if (!settings.enabled) {
    document.querySelectorAll("." + HIDDEN_CLASS).forEach(reveal);
    return;
  }
  for (const element of candidates()) void evaluate(element);
}
async function loadSettings(): Promise<void> {
  try {
    const stored = await chrome.storage.sync.get("tathabbutSettings");
    const candidate = stored.tathabbutSettings as Partial<UserSettings> | undefined;
    if (candidate && typeof candidate === "object") {
      settings = {
        enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_SETTINGS.enabled,
        enabledCategories: Array.isArray(candidate.enabledCategories)
          ? candidate.enabledCategories.filter((item): item is UserSettings["enabledCategories"][number] =>
              DEFAULT_SETTINGS.enabledCategories.includes(item as UserSettings["enabledCategories"][number]))
          : [...DEFAULT_SETTINGS.enabledCategories],
        threshold: typeof candidate.threshold === "number" && candidate.threshold >= 0 && candidate.threshold <= 1
          ? candidate.threshold : DEFAULT_SETTINGS.threshold,
        apiUrl: typeof candidate.apiUrl === "string" ? candidate.apiUrl.trim() : ""
      };
    }
  } catch { /* local defaults remain safe */ }
  scan();
}
void loadSettings();
new MutationObserver(() => scan()).observe(document.documentElement, { childList: true, subtree: true });
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.tathabbutSettings) {
    document.querySelectorAll("." + HIDDEN_CLASS).forEach(reveal);
    void loadSettings();
  }
});
