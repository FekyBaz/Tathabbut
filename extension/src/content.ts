import { CATEGORIES, DEFAULT_SETTINGS, classifyLocally, isUsableRemoteClassification, shouldHide, type Category, type Classification, type LabelScore, type UserSettings } from "./policy";
import { DEBUG_FLAG_KEY, STATUS_KEY, type ContentStatus } from "./diagnostics";
import { BoundedTaskQueue, fingerprintText, normalizeText } from "./text-engine";

const ARTICLE_SELECTOR = '[role="article"]';
// Semantic fallback units cover common web comments and standalone text blocks
// when a site does not expose role="article". Keep this list conservative.
const COMMENT_SELECTOR = '[role="comment"], [data-testid*="comment" i], .comment';
const STANDALONE_TEXT_SELECTOR = 'p, blockquote, li';
const CONTENT_UNIT_SELECTOR = ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR + ", " + STANDALONE_TEXT_SELECTOR;
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

// Writes go out only when the meaningful fields change (updatedAt alone
// does not count), plus forced writes at startup and after settings load.

interface RunStats {
  startedAt: number;
  settingsOk: boolean;
  articlesFound: number;
  evaluated: number;
  classified: number;
  hidden: number;
  skipped: number;
  skippedUnchanged: number;
  skippedEmpty: number;
  skippedDisabled: number;
  skippedQueueFull: number;
  lastReason: string;
}

const stats: RunStats = {
  startedAt: Date.now(),
  settingsOk: true,
  articlesFound: 0,
  evaluated: 0,
  classified: 0,
  hidden: 0,
  skipped: 0,
  skippedUnchanged: 0,
  skippedEmpty: 0,
  skippedDisabled: 0,
  skippedQueueFull: 0,
  lastReason: "starting"
};

const STATUS_MIN_INTERVAL_MS = 1000;

let lastStatusKey = "";
let lastStatusWrite = 0;

function currentStatus(): ContentStatus {
  return {
    startedAt: stats.startedAt,
    settingsOk: stats.settingsOk,
    enabled: settings.enabled,
    threshold: settings.threshold,
    categories: settings.enabledCategories.length,
    apiMode: settings.apiUrl ? "remote" : "local",
    articlesFound: stats.articlesFound,
    evaluated: stats.evaluated,
    classified: stats.classified,
    hidden: stats.hidden,
    skipped: stats.skipped,
    skippedUnchanged: stats.skippedUnchanged,
    skippedEmpty: stats.skippedEmpty,
    skippedDisabled: stats.skippedDisabled,
    skippedQueueFull: stats.skippedQueueFull,
    lastReason: stats.lastReason,
    origin: window.location.hostname,
    updatedAt: Date.now()
  };
}

// Best-effort, device-local snapshot for the popup status panel.
// Metadata only: counters, settings state, and outcome reasons.
// Never post text, names, or URLs. No network involved.
async function persistStatus(force: boolean): Promise<void> {
  try {
    const snapshot = currentStatus();
    const { updatedAt, ...stable } = snapshot;
    void updatedAt;
    const key = JSON.stringify(stable);
    const now = Date.now();
    if (!force) {
      if (key === lastStatusKey) return;
      if (now - lastStatusWrite < STATUS_MIN_INTERVAL_MS) return;
    }
    lastStatusKey = key;
    lastStatusWrite = now;
    await chrome.storage.local.set({ [STATUS_KEY]: snapshot });
  } catch {
    // Diagnostics must never break filtering.
  }
}

const DEBUG_PREFIX = "[Tathabbut debug]";
let debugEnabled = readLocalDebugFlag();

function readLocalDebugFlag(): boolean {
  try {
    return window.localStorage?.getItem("tathabbutDebug") === "1";
  } catch {
    return false;
  }
}

// Gated, metadata-only diagnostics. Never logs post text, author names,
// URLs, or page content: only counts, settings state, fingerprints
// (hash:length), classification outcomes, and skip reasons.
function debugLog(event: string, details?: Record<string, unknown>): void {
  if (!debugEnabled) return;
  if (details === undefined) console.info(DEBUG_PREFIX + " " + event);
  else console.info(DEBUG_PREFIX + " " + event, details);
}

export function readText(element: Element): string {
  // Do not mix the text of a post with separately represented comments.
  // Cloning also ensures extraction never mutates the live page DOM.
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR + ", .tathabbut-reveal")
    .forEach((nestedUnit) => nestedUnit.remove());
  return normalizeText(clone.textContent ?? "").slice(0, MAX_TEXT_LENGTH);
}

function isStandaloneTextBlock(element: Element): boolean {
  return element.matches(STANDALONE_TEXT_SELECTOR) &&
    !element.closest(ARTICLE_SELECTOR) &&
    !element.closest(COMMENT_SELECTOR);
}

function discoverUnits(root: ParentNode = document): Element[] {
  const found = new Set<Element>();
  root.querySelectorAll(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR).forEach((element) => found.add(element));
  root.querySelectorAll(STANDALONE_TEXT_SELECTOR).forEach((element) => {
    if (isStandaloneTextBlock(element)) found.add(element);
  });
  return Array.from(found);
}

function contentUnitFor(node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) return null;
  const closestUnit = element.closest(CONTENT_UNIT_SELECTOR);
  if (!closestUnit) return null;
  if (closestUnit.matches(STANDALONE_TEXT_SELECTOR) && !isStandaloneTextBlock(closestUnit)) {
    return closestUnit.closest(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR);
  }
  return closestUnit;
}

function unitsWithin(node: Node): Element[] {
  if (!(node instanceof Element)) return [];
  const found = discoverUnits(node);
  if (node.matches(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR) ||
      isStandaloneTextBlock(node)) found.unshift(node);
  return [...new Set(found)];
}

async function classify(text: string): Promise<Classification> {
  const localResult = classifyLocally(text);
  if (!settings.apiUrl) {
    debugLog("classify", { mode: "local", labels: localResult.labels.length });
    return localResult;
  }
  try {
    const response = await chrome.runtime.sendMessage({
      type: "tathabbut:classify-remote",
      apiUrl: settings.apiUrl,
      text,
      enabledCategories: settings.enabledCategories
    }) as { ok?: boolean; result?: unknown } | undefined;
    if (response?.ok && isUsableRemoteClassification(response.result)) {
      debugLog("classify", { mode: "remote", labels: response.result.labels.length });
      return response.result;
    }
  } catch {
    // Missing permission, unavailable service worker, or API failure uses local rules.
  }
  debugLog("classify", { mode: "remote-fallback-local", labels: localResult.labels.length });
  return localResult;
}
function wrapDirectTextNodes(element: Element): void {
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
    const wrapper = document.createElement("span");
    wrapper.className = "tathabbut-hidden-text";
    wrapper.textContent = node.textContent;
    element.replaceChild(wrapper, node);
  }
}

export function reveal(element: Element): void {
  element.classList.remove(HIDDEN_CLASS);
  element.removeAttribute("data-tathabbut-hidden");
  element.querySelectorAll(":scope > .tathabbut-reveal").forEach((button) => button.remove());
  element.querySelectorAll(":scope > .tathabbut-hidden-text").forEach((wrapper) => {
    wrapper.replaceWith(document.createTextNode(wrapper.textContent ?? ""));
  });
}

interface Decision {
  hidden: boolean;
  reason: string;
  category?: Category;
  score?: number;
}

// Mirrors shouldHide but explains WHY, for diagnostics only.
// Precedence: an actual hide beats a near-miss; a near-miss (rule matched
// but score below threshold) beats a disabled category; otherwise no match.
function describeDecision(result: Classification): Decision {
  if (!settings.enabled) return { hidden: false, reason: "filter-disabled" };
  let weak: LabelScore | undefined;
  let off: Category | undefined;
  for (const label of result.labels) {
    if (!CATEGORIES.includes(label.category)) continue;
    if (!settings.enabledCategories.includes(label.category)) {
      off ??= label.category;
      continue;
    }
    if (!Number.isFinite(label.score) || label.score < 0 || label.score > 1) continue;
    if (label.score >= settings.threshold) {
      return { hidden: true, reason: "rule-match", category: label.category, score: label.score };
    }
    weak ??= label;
  }
  if (weak !== undefined) {
    return { hidden: false, reason: "below-threshold", category: weak.category, score: weak.score };
  }
  if (off !== undefined) return { hidden: false, reason: "category-disabled", category: off };
  return { hidden: false, reason: "no-rule-match" };
}

export function applyResult(element: Element, result: Classification): void {
  const decision = describeDecision(result);
  const fingerprint = itemStates.get(element)?.fingerprint ?? "unknown";
  if (!decision.hidden) {
    reveal(element);
    const details: Record<string, unknown> = {
      decision: "shown",
      reason: decision.reason,
      fingerprint
    };
    stats.lastReason = decision.reason;
    void persistStatus(false);
    if (decision.category !== undefined) details.category = decision.category;
    if (decision.score !== undefined) details.score = decision.score;
    debugLog("decision", details);
    return;
  }
  if (element.getAttribute("data-tathabbut-hidden") === "true") return;
  // Text-only blocks (for example a standalone <p>) need a wrapper so CSS can
  // blur their text without blurring the reveal control or hiding sibling content.
  wrapDirectTextNodes(element);
  element.classList.add(HIDDEN_CLASS);
  element.setAttribute("data-tathabbut-hidden", "true");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tathabbut-reveal";
  button.textContent = "Tathabbut: reveal hidden content";
  button.setAttribute("aria-label", "Reveal content hidden by Tathabbut");
  button.addEventListener("click", () => reveal(element), { once: true });
  element.prepend(button);
  stats.hidden += 1;
  stats.lastReason = decision.reason;
  void persistStatus(true);
  debugLog("decision", {
    decision: "hidden",
    reason: decision.reason,
    category: decision.category,
    score: decision.score,
    fingerprint
  });
}

export function evaluate(element: Element): void {
  if (!(element instanceof HTMLElement) || !element.isConnected) return;
  if (!settings.enabled) {
    reveal(element);
    stats.skipped += 1;
    stats.skippedDisabled += 1;
    stats.lastReason = "filter-disabled";
    void persistStatus(false);
    debugLog("skip", { reason: "filter-disabled" });
    return;
  }

  const text = readText(element);
  if (!text) {
    itemStates.delete(element);
    reveal(element);
    stats.skipped += 1;
    stats.skippedEmpty += 1;
    stats.lastReason = "empty-text";
    void persistStatus(false);
    debugLog("skip", { reason: "empty-text" });
    return;
  }

  const fingerprint = fingerprintText(text);
  const previous = itemStates.get(element);
  if (previous?.fingerprint === fingerprint && previous.settingsVersion === settingsVersion) {
    stats.skipped += 1;
    stats.skippedUnchanged += 1;
    stats.lastReason = "unchanged";
    void persistStatus(false);
    debugLog("skip", { reason: "unchanged", fingerprint });
    return;
  }

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
    stats.classified += 1;
    applyResult(element, result);
  });

  // If the bounded queue is saturated, allow a later DOM change or settings update to retry.
  if (!accepted) {
    itemStates.delete(element);
    stats.skipped += 1;
    stats.skippedQueueFull += 1;
    stats.lastReason = "queue-full";
    void persistStatus(false);
    debugLog("skip", { reason: "queue-full", fingerprint });
    return;
  }
  stats.evaluated += 1;
}

export function scan(): void {
  const found = discoverUnits();
  stats.articlesFound = found.length;
  void persistStatus(false);
  debugLog("scan", { articles: found.length });
  for (const element of found) evaluate(element);
}

function processMutations(records: MutationRecord[]): void {
  const affected = new Set<Element>();
  for (const record of records) {
    const parentUnit = contentUnitFor(record.target);
    if (parentUnit) affected.add(parentUnit);
    for (const addedNode of Array.from(record.addedNodes)) {
      const containingUnit = contentUnitFor(addedNode);
      if (containingUnit) affected.add(containingUnit);
      for (const nestedUnit of unitsWithin(addedNode)) affected.add(nestedUnit);
    }
  }
  debugLog("mutations", { batches: records.length, affected: affected.size });
  for (const element of affected) evaluate(element);
}

async function loadSettings(): Promise<void> {
  let storedDebug: unknown = false;
  try {
    const stored = await chrome.storage.sync.get("tathabbutSettings");
    let localDebug: unknown = false;
    try {
      const localStored = await chrome.storage.local.get(DEBUG_FLAG_KEY);
      localDebug = localStored[DEBUG_FLAG_KEY];
      storedDebug = localDebug;
    } catch {
      // A missing local flag simply leaves diagnostics off.
    }
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
    stats.settingsOk = false;
  }

  debugEnabled = storedDebug === true || readLocalDebugFlag();
  void persistStatus(true);

  settingsVersion += 1;
  debugLog("settings", {
    enabled: settings.enabled,
    categories: settings.enabledCategories.length,
    threshold: settings.threshold,
    mode: settings.apiUrl ? "remote" : "local"
  });
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
  else if (areaName === "local" && changes[DEBUG_FLAG_KEY]) void loadSettings();
});

void persistStatus(true);
debugLog("loaded", { topFrame: window.top === window });
