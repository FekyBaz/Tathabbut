import { DEFAULT_SETTINGS, classifyLocally, isUsableRemoteClassification, shouldHide, type Classification, type UserSettings } from "./policy";
import { BoundedTaskQueue, fingerprintText, normalizeText } from "./text-engine";

const ARTICLE_SELECTOR = '[role="article"]';
const HIDDEN_CLASS = "tathabbut-hidden";
const MAX_TEXT_LENGTH = 4000;
const MAX_QUEUED_ITEMS = 200;
let settings: UserSettings = { ...DEFAULT_SETTINGS, enabledCategories: [...DEFAULT_SETTINGS.enabledCategories] };
let settingsVersion = 0;

interface ItemState {
  fingerprint: string;
  settingsVersion: number;
}
const itemStates = new WeakMap<Element, ItemState>();
const queue = new BoundedTaskQueue(2, MAX_QUEUED_ITEMS);

function readText(element: Element): string {
  // Our own reveal control must not change the fingerprint or trigger a reclassification.
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll(".tathabbut-reveal").forEach((control) => control.remove());
  return normalizeText(clone.textContent ?? "").slice(0, MAX_TEXT_LENGTH);
}

function articleFor(node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) return null;
  if (element.matches(ARTICLE_SELECTOR)) return element;
  return element.closest(ARTICLE_SELECTOR);
}

function articlesWithin(node: Node): Element[] {
  if (!(node instanceof Element)) return [];
  const found = Array.from(node.querySelectorAll(ARTICLE_SELECTOR));
  if (node.matches(ARTICLE_SELECTOR)) found.unshift(node);
  return found;
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
    // Fail open: a failed or unavailable API must not hide content.
    return localResult;
  }
}

function reveal(element: Element): void {
  element.classList.remove(HIDDEN_CLASS);
  element.removeAttribute("data-tathabbut-hidden");
  element.querySelectorAll(":scope > .tathabbut-reveal").forEach((button) => button.remove());
}

function applyResult(element: Element, result: Classification): void {
  if (!shouldHide(result, settings)) {
    reveal(element);
    return;
  }
  if (element.getAttribute("data-tathabbut-hidden") === "true") return;
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

function evaluate(element: Element): void {
  if (!(element instanceof HTMLElement) || !element.isConnected) return;
  if (!settings.enabled) {
    reveal(element);
    return;
  }

  const text = readText(element);
  if (!text) {
    itemStates.delete(element);
    reveal(element);
    return;
  }

  const fingerprint = fingerprintText(text);
  const previous = itemStates.get(element);
  if (previous?.fingerprint === fingerprint && previous.settingsVersion === settingsVersion) return;

  // A changed post invalidates the previous decision immediately; stale async results cannot re-hide it.
  reveal(element);
  const state: ItemState = { fingerprint, settingsVersion };
  itemStates.set(element, state);

  const accepted = queue.enqueue(async () => {
    const result = await classify(text);
    const latest = itemStates.get(element);
    if (!element.isConnected ||
        latest?.fingerprint !== fingerprint ||
        latest.settingsVersion !== settingsVersion ||
        state.settingsVersion !== settingsVersion) return;
    applyResult(element, result);
  });

  // If the bounded queue is saturated, allow a later DOM change or settings update to retry.
  if (!accepted) itemStates.delete(element);
}

function scan(): void {
  for (const element of document.querySelectorAll(ARTICLE_SELECTOR)) evaluate(element);
}

function processMutations(records: MutationRecord[]): void {
  const affected = new Set<Element>();
  for (const record of records) {
    const parentArticle = articleFor(record.target);
    if (parentArticle) affected.add(parentArticle);
    for (const addedNode of record.addedNodes) {
      const containingArticle = articleFor(addedNode);
      if (containingArticle) affected.add(containingArticle);
      for (const nestedArticle of articlesWithin(addedNode)) affected.add(nestedArticle);
    }
  }
  for (const element of affected) evaluate(element);
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
    } else {
      settings = { ...DEFAULT_SETTINGS, enabledCategories: [...DEFAULT_SETTINGS.enabledCategories] };
    }
  } catch {
    // Keep safe local defaults if extension storage is unavailable.
  }

  settingsVersion += 1;
  document.querySelectorAll("." + HIDDEN_CLASS).forEach(reveal);
  scan();
}

void loadSettings();

const observer = new MutationObserver(processMutations);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.tathabbutSettings) void loadSettings();
});
