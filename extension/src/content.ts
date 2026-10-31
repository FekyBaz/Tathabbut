import { CATEGORIES, DEFAULT_SETTINGS, classifyLocally, isUsableRemoteClassification, normalizeForRules, shouldHide, type Category, type Classification, type LabelScore, type UserSettings } from "./policy";
import { DEBUG_FLAG_KEY, STATUS_KEY, type ContentStatus } from "./diagnostics";
import { pickLanguage, t } from "./i18n";
import { BoundedTaskQueue, fingerprintText, normalizeText } from "./text-engine";

const ARTICLE_SELECTOR = '[role="article"]';
// Semantic fallback units cover common web comments and standalone text blocks
// when a site does not expose role="article". Keep this list conservative.
const COMMENT_SELECTOR = '[role="comment"], [data-testid="comment" i], [data-testid^="comment-" i], .comment';
const STANDALONE_TEXT_SELECTOR = 'p, blockquote, li';
const CONTENT_UNIT_SELECTOR = ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR + ", " + STANDALONE_TEXT_SELECTOR;
// Facebook's current mobile/SSR feed renders text inside
// [data-mcomponent="ServerTextArea"] components. The shared layout classes
// (.m, .bg-s3) and the MContainer wrappers around a post are NOT sufficient
// evidence of a post: author, reactions, and comments are separate siblings.
// This fallback starts at the text component and descends to the smallest
// block that carries the text, so it never selects the vscroller/screen/feed.
const SERVER_TEXT_SELECTOR = '[data-mcomponent="ServerTextArea"]';
// Text inside controls, editable fields, or hidden/virtualized regions is not
// feed content. Anchors are deliberately NOT suppressed: Facebook often makes
// real content navigable, and benign author names simply classify as shown.
// Kept as (reason, selector) pairs so discovery diagnostics can say WHY a
// candidate was rejected without logging its text.
const SUPPRESSED_CONTEXTS: ReadonlyArray<readonly [string, string]> = [
  ["button", "button"],
  ["role-button", '[role="button"]'],
  ["editable", '[contenteditable]:not([contenteditable="false"])'],
  ["role-navigation", '[role="navigation"]'],
  ["role-banner", '[role="banner"]'],
  ["hidden-attribute", "[hidden]"],
  ["aria-hidden", '[aria-hidden="true"]']
];
const HIDDEN_CLASS = "tathabbut-hidden";
const MAX_TEXT_LENGTH = 4000;
const MAX_QUEUED_ITEMS = 200;
let settings: UserSettings = { ...DEFAULT_SETTINGS, enabledCategories: [...DEFAULT_SETTINGS.enabledCategories] };
let settingsVersion = 0;
// Set by dispose() to make a torn-down instance inert: a re-created content
// script instance must not let the previous one keep observing or mutating the page.
let disposed = false;

interface ItemState {
  fingerprint: string;
  settingsVersion: number;
}
const itemStates = new WeakMap<Element, ItemState>();
// Unit evaluated -> element actually hidden. Usually identical; differs
// when a match is isolated to one child block (see narrowTarget).
const hiddenTarget = new WeakMap<Element, Element>();
// Reverse mapping lets reveal controls and settings refreshes clean up the
// exact owner/target pair, including when the target is a narrowed child.
const hiddenOwner = new WeakMap<Element, Element>();
interface ManualRevealState {
  fingerprint: string;
  settingsVersion: number;
}
// A user reveal survives incidental mutations outside the actual hidden target.
// It expires when that target's text or the current settings version changes.
const manualReveals = new WeakMap<Element, ManualRevealState>();

// Block containers stable enough to carry a hide control. Inline elements
// (span, a, …) are excluded: collapsing them is unreliable and a reveal
// button inside running text corrupts readability.
const CONTAINER_TAGS = new Set(["div", "p", "li", "blockquote", "section", "article"]);
const queue = new BoundedTaskQueue(2, MAX_QUEUED_ITEMS);

// Which discovery path produced a unit. Diagnostics only; never affects
// classification or hiding.
type UnitSource = "desktop" | "ssr";
const unitSource = new WeakMap<Element, UnitSource>();

// Counts metadata only: no post text, names, or URLs. Collected per scan and
// per (throttled) mutation batch so the next live run can distinguish
// "selector/hydration found nothing" from "candidates were rejected" from
// "candidates were classified but no rule matched".
interface DiscoveryReport {
  areas: number;
  leaves: number;
  nativeTextLeaves: number;
  nativeTextNodes: number;
  f1Nodes: number;
  suppressed: Record<string, number>;
  insideExisting: number;
  desktopUnits: number;
  serverUnits: number;
  uniqueUnits: number;
  postUnits: number;
  commentUnits: number;
  replyUnits: number;
  unknownUnits: number;
  mixedSkipped: number;
  duplicateNested: number;
  duplicateCandidates: number;
}

function createDiscoveryReport(): DiscoveryReport {
  return {
    areas: 0,
    leaves: 0,
    nativeTextLeaves: 0,
    nativeTextNodes: 0,
    f1Nodes: 0,
    suppressed: {},
    insideExisting: 0,
    desktopUnits: 0,
    serverUnits: 0,
    uniqueUnits: 0,
    postUnits: 0,
    commentUnits: 0,
    replyUnits: 0,
    unknownUnits: 0,
    mixedSkipped: 0,
    duplicateNested: 0,
    duplicateCandidates: 0
  };
}

function countSuppression(report: DiscoveryReport, reason: string): void {
  report.suppressed[reason] = (report.suppressed[reason] ?? 0) + 1;
}

// Writes go out only when the meaningful fields change (updatedAt alone
// does not count), plus forced writes at startup and after settings load.

interface RunStats {
  startedAt: number;
  settingsOk: boolean;
  articlesFound: number;
  evaluated: number;
  classified: number;
  shown: number;
  hidden: number;
  hideFailed: number;
  noRuleMatch: number;
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
  shown: 0,
  hidden: 0,
  hideFailed: 0,
  noRuleMatch: 0,
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
    hideFailed: stats.hideFailed,
    noRuleMatch: stats.noRuleMatch,
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
  if (disposed) {
    lifecycleGuard("persistStatus");
    return;
  }
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
const candidateIds = new WeakMap<Element, string>();
let nextCandidateId = 1;
const lastEmptyExtractionReport = new WeakMap<Element, boolean>();
const lastCandidateSkip = new WeakMap<Element, string>();

function diagnosticCandidateId(element: Element): string | undefined {
  if (!debugEnabled) return undefined;
  let id = candidateIds.get(element);
  if (id === undefined) {
    id = `c${nextCandidateId++}`;
    candidateIds.set(element, id);
  }
  return id;
}

function debugCandidateSkip(element: Element, signature: string, details: Record<string, unknown>): void {
  if (!debugEnabled || lastCandidateSkip.get(element) === signature) return;
  lastCandidateSkip.set(element, signature);
  debugLog("skip", details);
}

function readLocalDebugFlag(): boolean {
  try {
    return window.localStorage?.getItem("tathabbutDebug") === "1";
  } catch {
    return false;
  }
}

// Gated, metadata-only diagnostics. Never logs post text, author names,
// URLs, page content, or text-derived identifiers: only bounded metadata,
// ephemeral candidate IDs, classification outcomes, and skip reasons.
function debugLog(event: string, details?: Record<string, unknown>): void {
  if (!debugEnabled) return;
  try {
    if (details === undefined) console.info(DEBUG_PREFIX + " " + event);
    else console.info(DEBUG_PREFIX + " " + event, details);
  } catch {
    // Local diagnostics must never interrupt classification or DOM updates.
  }
}

// Development-only lifecycle diagnostics. Disabled by default, independent of
// filtering and of the existing [Tathabbut debug] channel. Enable it from the
// page Console with localStorage.setItem("tathabbutLifecycleDebug", "1") and
// reload; disable with localStorage.removeItem(...). It logs only lifecycle
// events (init, observer/listener setup and teardown, pagehide persisted vs
// dispose, and guards that drop work after disposal) and never logs post text,
// author names, or URLs. It swallows its own errors so it cannot change
// extension behavior.
const LIFECYCLE_DEBUG_KEY = "tathabbutLifecycleDebug";
const LIFECYCLE_PREFIX = "[Tathabbut:Lifecycle]";

function lifecycleDiagnosticsEnabled(): boolean {
  try {
    return window.localStorage?.getItem(LIFECYCLE_DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function lifecycleLog(event: string, details?: Record<string, unknown>): void {
  try {
    if (!lifecycleDiagnosticsEnabled()) return;
    if (details === undefined) console.info(LIFECYCLE_PREFIX + " " + event);
    else console.info(LIFECYCLE_PREFIX + " " + event, details);
  } catch {
    // Lifecycle diagnostics must never affect extension behavior.
  }
}

function lifecycleGuard(where: string): void {
  lifecycleLog("guard:reject", { where });
}

// Aggregated outcome counters (never text). Throttled so a burst of results
// cannot flood the console.
let lastProgressReportAt = 0;
let progressTimer: number | undefined;

function reportProgress(force = false): void {
  if (!debugEnabled) return;
  const now = Date.now();
  if (!force && now - lastProgressReportAt < 1000) {
    // Schedule a trailing summary so the final result of a burst is not lost.
    if (progressTimer === undefined && !disposed) {
      progressTimer = window.setTimeout(() => {
        progressTimer = undefined;
        reportProgress(true);
      }, 1000 - (now - lastProgressReportAt));
    }
    return;
  }
  lastProgressReportAt = now;
  debugLog("progress", {
    evaluated: stats.evaluated,
    classified: stats.classified,
    shown: stats.shown,
    hidden: stats.hidden,
    hideFailed: stats.hideFailed,
    noRuleMatch: stats.noRuleMatch,
    duplicates: stats.skippedUnchanged,
    lastReason: stats.lastReason
  });
}

// UI labels that are often rendered as sibling spans with no whitespace before
// the post body (for example "…idiot" + "See more"). They are controls, not
// post content, and concatenating them can destroy a word boundary that a rule
// depends on.
const UI_TEXT_LABELS = new Set([
  "see more", "see less", "see translation", "see original",
  "like", "comment", "share", "reply", "send",
  "عرض المزيد", "عرض أقل", "عرض الترجمة", "عرض النص الأصلي",
  "إعجاب", "تعليق", "مشاركة", "رد", "إرسال"
]);

function removeUiLabels(clone: Element): void {
  clone.querySelectorAll('button, [role="button"], span').forEach((element) => {
    if (UI_TEXT_LABELS.has(normalizeText(element.textContent ?? "").toLowerCase())) {
      element.remove();
    }
  });
}

const BLOCK_TEXT_SELECTOR =
  "div, p, li, section, article, blockquote, header, footer, main, aside, nav, " +
  "h1, h2, h3, h4, h5, h6, tr, td, th, br";

function separateBlockText(clone: Element): void {
  clone.querySelectorAll(BLOCK_TEXT_SELECTOR).forEach((block) => {
    if (block.tagName.toLowerCase() === "br") {
      block.replaceWith(" ");
      return;
    }
    block.before(" ");
    block.append(" ");
  });
}

export function readText(element: Element, isolateNestedText = false): string {
  // Do not mix the text of a post with separately represented comments.
  // Cloning also ensures extraction never mutates the live page DOM.
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll(
    ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR + ", .tathabbut-reveal, .tathabbut-notice"
  )
    .forEach((nestedUnit) => nestedUnit.remove());
  if (isolateNestedText) {
    // An SSR leaf may contain a nested independent text region (a reply or a
    // duplicate render). The leaf's own text is the only safe classification
    // input; the nested region is discovered separately or intentionally
    // skipped when no safe boundary exists.
    clone.querySelectorAll(".native-text, " + SERVER_TEXT_SELECTOR)
      .forEach((nestedText) => nestedText.remove());
  }
  removeUiLabels(clone);
  separateBlockText(clone);
  return normalizeText(clone.textContent ?? "").slice(0, MAX_TEXT_LENGTH);
}

function textForUnit(element: Element): string {
  return readText(
    element,
    unitSource.get(element) === "ssr" || element.matches(".native-text")
  );
}

function isStandaloneTextBlock(element: Element): boolean {
  return element.matches(STANDALONE_TEXT_SELECTOR) &&
    !element.closest(ARTICLE_SELECTOR) &&
    !element.closest(COMMENT_SELECTOR);
}

function suppressionReason(element: Element): string | null {
  for (const [reason, selector] of SUPPRESSED_CONTEXTS) {
    if (element.closest(selector) !== null) return reason;
  }
  return null;
}

function isSuppressedTextContext(element: Element): boolean {
  return suppressionReason(element) !== null;
}

// Text carried directly by the element (its own text nodes and inline
// descendants), excluding nested block children. If this is non-empty the
// element is a leaf: its own text lives inline (e.g. native-text > span.f1).
function inlineTextOf(element: Element): string {
  let out = "";
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
    } else if (node instanceof Element && !CONTAINER_TAGS.has(node.tagName.toLowerCase())) {
      out += node.textContent ?? "";
    }
  }
  return normalizeText(out);
}

// Descend through pure block wrappers to the smallest text-bearing blocks.
// - A wrapper whose text is entirely inside one block child is descended.
// - A block holding its own inline text is a leaf.
// - Several text-bearing block children (e.g. a comments region) are split so
//   one offensive item cannot hide its siblings.
function isIndependentTextRegion(element: Element): boolean {
  return element.matches(".native-text") || element.matches(SERVER_TEXT_SELECTOR);
}

function leafServerTextBlocks(root: Element, report?: DiscoveryReport): Element[] {
  const leaves: Element[] = [];
  const visit = (element: Element): void => {
    const text = normalizeText(element.textContent ?? "");
    if (text === "") return;
    const blockChildren = Array.from(element.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        CONTAINER_TAGS.has(child.tagName.toLowerCase()) &&
        !child.matches(".tathabbut-reveal, .tathabbut-notice, .tathabbut-hidden-text") &&
        normalizeText(child.textContent ?? "") !== ""
    );
    const ownInline = inlineTextOf(element);
    const nestedRegions = blockChildren.filter(isIndependentTextRegion);
    if (ownInline !== "" && nestedRegions.length > 0) {
      // Compare the isolated text (nested regions and UI labels removed) so a
      // duplicate that carries an extra See more control still counts once.
      const ownText = readText(element, true);
      const nestedText = nestedRegions.map((child) => readText(child, true));
      if (ownText !== "" && nestedText.every((candidate) => candidate === ownText)) {
        // The parent and its child render the same text. Keep one target and
        // let readText(isolateNestedText) exclude the duplicate child.
        if (report !== undefined) report.duplicateNested += 1;
        leaves.push(element);
        return;
      }
      // The element mixes its own inline text with a different independent
      // region (for example a comment and a nested reply). Hiding the parent
      // would hide the nested region too, so process only the nested region.
      if (report !== undefined) report.mixedSkipped += 1;
      for (const child of blockChildren) leaves.push(...leafServerTextBlocks(child, report));
      return;
    }
    if (blockChildren.length === 0 || ownInline !== "") {
      leaves.push(element);
      return;
    }
    for (const child of blockChildren) visit(child);
  };
  visit(root);
  return leaves;
}

function discoverServerTextRegions(root: ParentNode, report?: DiscoveryReport): Element[] {
  const regions = new Set<Element>();
  const areas: Element[] = [];
  // querySelectorAll excludes the root itself, so include a root that is a text
  // component (dynamic insertion hands us the inserted node directly).
  if (root instanceof Element && root.matches(SERVER_TEXT_SELECTOR)) areas.push(root);
  root.querySelectorAll(SERVER_TEXT_SELECTOR).forEach((area) => areas.push(area));
  for (const area of areas) {
    if (report !== undefined) {
      report.areas += 1;
      report.nativeTextNodes += area.querySelectorAll(".native-text").length;
      report.f1Nodes += area.querySelectorAll("span.f1").length;
    }
    const areaReason = suppressionReason(area);
    if (areaReason !== null) {
      if (report !== undefined) countSuppression(report, areaReason);
      continue;
    }
    for (const leaf of leafServerTextBlocks(area, report)) {
      if (report !== undefined) {
        report.leaves += 1;
        // The live mobile post body shape: .native-text > span.f1 (plus siblings).
        if (leaf.matches(".native-text") || leaf.querySelector(":scope > span.f1") !== null) {
          report.nativeTextLeaves += 1;
        }
      }
      const leafReason = suppressionReason(leaf);
      if (leafReason !== null) {
        if (report !== undefined) countSuppression(report, "leaf:" + leafReason);
        continue;
      }
      if (regions.has(leaf)) {
        if (report !== undefined) report.duplicateCandidates += 1;
      } else {
        regions.add(leaf);
      }
    }
  }
  return Array.from(regions);
}

function isWithinExistingUnit(element: Element): boolean {
  if (element.closest(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR)) return true;
  const standalone = element.closest(STANDALONE_TEXT_SELECTOR);
  return standalone !== null && isStandaloneTextBlock(standalone);
}

type UnitKind = "post" | "comment" | "reply" | "unknown";

function unitKind(element: Element): UnitKind {
  const comment = element.closest(COMMENT_SELECTOR);
  if (comment !== null) {
    const parentComment = comment.parentElement?.closest(COMMENT_SELECTOR) ?? null;
    return parentComment === null ? "comment" : "reply";
  }
  if (element.closest(ARTICLE_SELECTOR) !== null) return "post";
  return "unknown";
}

function countUnitKind(report: DiscoveryReport, kind: UnitKind): void {
  if (kind === "post") report.postUnits += 1;
  else if (kind === "comment") report.commentUnits += 1;
  else if (kind === "reply") report.replyUnits += 1;
  else report.unknownUnits += 1;
}

function discoverUnits(root: ParentNode = document, report?: DiscoveryReport): Element[] {
  const found = new Set<Element>();
  const desktop = new Set<Element>();
  root.querySelectorAll(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR).forEach((element) => desktop.add(element));
  root.querySelectorAll(STANDALONE_TEXT_SELECTOR).forEach((element) => {
    if (isStandaloneTextBlock(element)) desktop.add(element);
  });
  for (const element of desktop) {
    if (found.has(element)) {
      if (report !== undefined) report.duplicateCandidates += 1;
      continue;
    }
    found.add(element);
    unitSource.set(element, "desktop");
  }
  // Conventional desktop units keep ownership of any text nested inside them.
  for (const region of discoverServerTextRegions(root, report)) {
    if (isWithinExistingUnit(region)) {
      if (report !== undefined) report.insideExisting += 1;
      continue;
    }
    if (found.has(region)) {
      if (report !== undefined) report.duplicateCandidates += 1;
      continue;
    }
    found.add(region);
    unitSource.set(region, "ssr");
    if (report !== undefined) report.serverUnits += 1;
  }
  if (report !== undefined) {
    report.desktopUnits += desktop.size;
    report.uniqueUnits = found.size;
    for (const element of found) countUnitKind(report, unitKind(element));
  }
  return Array.from(found);
}

function contentUnitFor(node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) return null;
  const closestUnit = element.closest(CONTENT_UNIT_SELECTOR);
  if (closestUnit) {
    if (closestUnit.matches(STANDALONE_TEXT_SELECTOR) && !isStandaloneTextBlock(closestUnit)) {
      const owner = closestUnit.closest(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR);
      if (owner !== null) unitSource.set(owner, "desktop");
      return owner;
    }
    unitSource.set(closestUnit, "desktop");
    return closestUnit;
  }
  // SSR/mobile text components are not matched by CONTENT_UNIT_SELECTOR; map a
  // mutation inside one to the smallest block that owns the changed node.
  const serverArea = element.closest(SERVER_TEXT_SELECTOR);
  if (serverArea === null || isSuppressedTextContext(serverArea)) return null;
  const owners = leafServerTextBlocks(serverArea).filter(
    (leaf) => !isSuppressedTextContext(leaf) && (leaf === element || leaf.contains(element))
  );
  // Choose the deepest owning leaf so a mutation inside a nested reply does
  // not re-evaluate (and hide) its containing comment.
  const owner = owners.reduce<Element | undefined>(
    (deepest, leaf) => (deepest === undefined || leaf.contains(deepest) ? leaf : deepest),
    undefined
  );
  if (owner !== undefined) unitSource.set(owner, "ssr");
  return owner ?? null;
}

function unitsWithin(node: Node, report?: DiscoveryReport): Element[] {
  if (!(node instanceof Element)) return [];
  const found = discoverUnits(node, report);
  if (node.matches(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR) ||
      isStandaloneTextBlock(node)) {
    found.unshift(node);
    unitSource.set(node, "desktop");
  }
  return [...new Set(found)];
}

function normalizationFlags(text: string): Record<string, boolean> {
  return {
    nfkc: text.normalize("NFKC") !== text,
    arabicDiacriticsOrTatweel: /[\u064B-\u065F\u0670\u0640]/u.test(text),
    invisibleOrBidi: /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/u.test(text),
    typographicApostrophe: /[\u2018\u2019\u02BC`´]/u.test(text),
    alefVariant: /[أإآٱ]/u.test(text),
    alefMaqsura: /ى/u.test(text),
    whitespaceNeedsNormalization: /^\s|\s$|\s{2,}/u.test(text)
  };
}

async function classify(text: string, candidateId: string | undefined): Promise<Classification> {
  const localResult = classifyLocally(text);
  if (debugEnabled) {
    const normalized = normalizeForRules(text);
    debugLog("normalization", {
      candidateId,
      inputLength: text.length,
      outputLength: normalized.length,
      flags: normalizationFlags(text)
    });
  }
  const classificationDetails = (mode: string, result: Classification) => ({
    candidateId,
    mode,
    labels: result.labels.slice(0, CATEGORIES.length).map(({ category, score }) => ({ category, score })),
    localRuleIds: localResult.matches?.map(({ ruleId }) => ruleId).slice(0, 32) ?? [],
    enabledCategories: [...settings.enabledCategories],
    threshold: settings.threshold
  });
  if (!settings.apiUrl) {
    debugLog("classify", classificationDetails("local", localResult));
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
      debugLog("classify", classificationDetails("remote", response.result));
      return response.result;
    }
  } catch {
    // Missing permission, unavailable service worker, or API failure uses local rules.
  }
  debugLog("classify", classificationDetails("remote-fallback-local", localResult));
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

function clearHiddenPresentation(target: Element): void {
  target.classList.remove(HIDDEN_CLASS);
  target.removeAttribute("data-tathabbut-hidden");
  target
    .querySelectorAll(":scope > .tathabbut-reveal, :scope > .tathabbut-notice")
    .forEach((control) => control.remove());
  target.querySelectorAll(":scope > .tathabbut-hidden-text").forEach((wrapper) => {
    wrapper.replaceWith(document.createTextNode(wrapper.textContent ?? ""));
  });
}

function releaseHiddenTarget(owner: Element, target: Element, userInitiated: boolean): void {
  if (userInitiated) {
    manualReveals.set(target, {
      fingerprint: fingerprintText(textForUnit(target)),
      settingsVersion
    });
  }
  hiddenTarget.delete(owner);
  if (hiddenOwner.get(target) === owner) hiddenOwner.delete(target);
  clearHiddenPresentation(target);
}

// Facebook may re-render attributes independently of child nodes. Treat the
// controls themselves as the idempotency marker too, and repair duplicate
// direct controls rather than inserting a second hide notice for the same DOM
// target. Incomplete stale presentation is removed and rebuilt by applyResult.
function reuseExistingHidePresentation(target: Element): boolean {
  const notices = Array.from(target.children).filter((child) => child.classList.contains("tathabbut-notice"));
  const buttons = Array.from(target.children).filter((child) => child.classList.contains("tathabbut-reveal"));
  if (notices.length === 0 && buttons.length === 0) return false;
  if (notices.length === 0 || buttons.length === 0) {
    [...notices, ...buttons].forEach((control) => control.remove());
    return false;
  }
  notices.slice(1).forEach((control) => control.remove());
  buttons.slice(1).forEach((control) => control.remove());
  target.classList.add(HIDDEN_CLASS);
  target.setAttribute("data-tathabbut-hidden", "true");
  return true;
}

export function reveal(element: Element, reason = "reconsideration"): void {
  if (disposed) {
    lifecycleGuard("reveal");
    return;
  }
  // Prefer the forward mapping when the caller passes the evaluated unit;
  // otherwise resolve a narrowed target back to its owner.
  const owner = hiddenTarget.has(element) ? element : (hiddenOwner.get(element) ?? element);
  const target = hiddenTarget.get(owner) ?? element;
  const wasHidden = hiddenTarget.has(owner) || hiddenOwner.has(target) || target.classList.contains(HIDDEN_CLASS);
  if (wasHidden) debugLog("reveal", { candidateId: diagnosticCandidateId(owner), reason,
    connected: target.isConnected });
  releaseHiddenTarget(owner, target, false);
}

function revealFromButton(owner: Element, target: Element): void {
  if (disposed) {
    lifecycleGuard("revealFromButton");
    return;
  }
  debugLog("reveal", { candidateId: diagnosticCandidateId(owner), reason: "user-click",
    connected: target.isConnected });
  releaseHiddenTarget(owner, target, true);
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

function categoryDecisionSummary(result: Classification): Array<Record<string, unknown>> {
  return CATEGORIES.map((category) => {
    const label = result.labels.find((item) => item.category === category);
    const enabled = settings.enabledCategories.includes(category);
    return { category, matched: label !== undefined, score: label?.score ?? null, enabled,
      threshold: settings.threshold,
      hide: settings.enabled && enabled && label !== undefined &&
        Number.isFinite(label.score) && label.score >= settings.threshold };
  });
}

/**
 * Return the element that should actually be hidden for a unit-level
 * hide decision: the single matching child block when the unit holds
 * several sibling blocks and exactly one of them independently hides,
 * otherwise the unit itself. Multi-match units, single-block units, and
 * remote verdicts without a local explanation all keep unit-level hiding.
 */
function narrowTarget(element: Element): Element {
  if (!shouldHide(classifyLocally(textForUnit(element)), settings)) return element;
  const kids = Array.from(element.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      CONTAINER_TAGS.has(child.tagName.toLowerCase()) &&
      !child.matches(".tathabbut-reveal, .tathabbut-notice, .tathabbut-hidden-text") &&
      !child.matches(ARTICLE_SELECTOR + ", " + COMMENT_SELECTOR)
  );
  if (kids.length < 2) return element;
  const matching = kids.filter((child) => {
    const text = textForUnit(child);
    return text !== "" && shouldHide(classifyLocally(text), settings);
  });
  return matching.length === 1 ? matching[0] : element;
}

export function applyResult(element: Element, result: Classification, candidateId = diagnosticCandidateId(element)): void {
  if (disposed) {
    lifecycleGuard("applyResult");
    return;
  }
  const decision = describeDecision(result);
  const via = unitSource.get(element) ?? "unknown";
  const kind = unitKind(element);
  if (!decision.hidden) {
    reveal(element, "classification-show");
    stats.shown += 1;
    if (decision.reason === "no-rule-match") stats.noRuleMatch += 1;
    const details: Record<string, unknown> = {
      decision: "shown",
      reason: decision.reason,
      candidateId,
      via,
      kind,
      categoryDecisions: categoryDecisionSummary(result)
    };
    stats.lastReason = decision.reason;
    void persistStatus(false);
    if (decision.category !== undefined) details.category = decision.category;
    if (decision.score !== undefined) details.score = decision.score;
    debugLog("decision", details);
    reportProgress();
    return;
  }
  // Hide the tightest block that isolates the match instead of a broad
  // ancestor: a harassing reply must not take respectful siblings with it.
  // Single-block units keep unit-level hiding (no pointless reparenting).
  // Nested comment/article units manage themselves and are never absorbed.
  // Remote verdicts without a local explanation keep unit-level hiding.
  const target = narrowTarget(element);
  const manualReveal = manualReveals.get(target);
  if (manualReveal !== undefined) {
    const currentTargetFingerprint = fingerprintText(textForUnit(target));
    if (manualReveal.settingsVersion === settingsVersion &&
        manualReveal.fingerprint === currentTargetFingerprint) {
      stats.lastReason = "user-revealed";
      void persistStatus(false);
      debugLog("decision", {
        decision: "shown",
        reason: "user-revealed",
        candidateId,
        via,
        kind,
        categoryDecisions: categoryDecisionSummary(result),
        narrowed: target !== element
      });
      reportProgress();
      return;
    }
    // The user changed the target text or policy settings changed; reconsider it.
    manualReveals.delete(target);
  }
  debugLog("hide", { candidateId, stage: "attempt", narrowed: target !== element });
  const controlsBefore = target.querySelectorAll(":scope > .tathabbut-reveal, :scope > .tathabbut-notice").length;
  if (reuseExistingHidePresentation(target)) {
    if (!hiddenTarget.has(element) && !hiddenOwner.has(target)) {
      hiddenTarget.set(element, target);
      hiddenOwner.set(target, element);
    }
    debugLog("hide", { candidateId, stage: "reused", controlsBefore,
      duplicateControlsRemoved: Math.max(0, controlsBefore - 2),
      controlsAfter: target.querySelectorAll(":scope > .tathabbut-reveal, :scope > .tathabbut-notice").length });
    return;
  }
  const controlsAfterCleanup = target.querySelectorAll(":scope > .tathabbut-reveal, :scope > .tathabbut-notice").length;
  // Text-only blocks (for example a standalone <p>) need a wrapper so CSS can
  // blur their text without blurring the reveal control or hiding sibling content.
  try {
    wrapDirectTextNodes(target);
    target.classList.add(HIDDEN_CLASS);
    target.setAttribute("data-tathabbut-hidden", "true");
    const strings = t(settings.language);
    const notice = document.createElement("span");
    notice.className = "tathabbut-notice";
    notice.setAttribute("lang", settings.language === "ar" ? "ar" : "en");
    notice.textContent = strings.noticeHidden + " " + strings.noticeSupport;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tathabbut-reveal";
    button.textContent = strings.revealLabel;
    button.setAttribute("aria-label", strings.revealAria);
    button.addEventListener("click", () => revealFromButton(element, target), { once: true });
    target.prepend(button);
    target.prepend(notice);
  } catch {
    // A page re-render can make the selected target temporarily unwritable.
    // Restore any partial presentation so a failed hide never leaves a
    // half-blurred block or an orphan control behind.
    try {
      clearHiddenPresentation(target);
    } catch {
      // Best-effort cleanup only.
    }
    stats.hideFailed += 1;
    stats.lastReason = "hide-failed";
    void persistStatus(true);
    debugLog("decision", {
      decision: "hide-failed",
      reason: "dom-error",
      candidateId,
      via,
      kind,
      narrowed: target !== element,
      categoryDecisions: categoryDecisionSummary(result)
    });
    debugLog("hide", { candidateId, stage: "failed", failureStage: "apply-or-cleanup" });
    reportProgress();
    return;
  }
  hiddenTarget.set(element, target);
  hiddenOwner.set(target, element);
  stats.hidden += 1;
  stats.lastReason = decision.reason;
  void persistStatus(true);
  debugLog("decision", {
    decision: "hidden",
    narrowed: target !== element,
    reason: decision.reason,
    category: decision.category,
    score: decision.score,
    candidateId,
    categoryDecisions: categoryDecisionSummary(result),
    via,
    kind
  });
  debugLog("hide", { candidateId, stage: "success", narrowed: target !== element,
    controlsBefore, duplicateControlsRemoved: Math.max(0, controlsBefore - controlsAfterCleanup), controlsAfterCleanup,
    controlsAfter: target.querySelectorAll(":scope > .tathabbut-reveal, :scope > .tathabbut-notice").length });
  reportProgress();
}

export function evaluate(element: Element, trigger: "scan" | "mutation" = "scan"): void {
  if (disposed) {
    lifecycleGuard("evaluate");
    return;
  }
  const candidateId = element instanceof Element ? diagnosticCandidateId(element) : undefined;
  if (!(element instanceof HTMLElement) || !element.isConnected) {
    debugLog("candidate", { candidateId, stage: "evaluate", trigger, connected: false,
      outcome: "detached-or-not-html-element" });
    return;
  }
  if (!settings.enabled) {
    reveal(element, "filter-disabled");
    stats.skipped += 1;
    stats.skippedDisabled += 1;
    stats.lastReason = "filter-disabled";
    void persistStatus(false);
    debugCandidateSkip(element, `filter-disabled:${settingsVersion}`, { candidateId, reason: "filter-disabled", trigger });
    return;
  }

  const text = textForUnit(element);
  if (!text) {
    if (debugEnabled && lastEmptyExtractionReport.get(element) !== true) {
      debugLog("candidate", { candidateId, stage: "extraction", trigger,
        kind: unitKind(element), source: unitSource.get(element) ?? "unknown", textLength: 0,
        outcome: "empty", connected: element.isConnected, nestedUnitsExcluded: true,
        nestedTextIsolated: unitSource.get(element) === "ssr" || element.matches(".native-text") });
      lastEmptyExtractionReport.set(element, true);
    }
    itemStates.delete(element);
    reveal(element, "empty-text");
    stats.skipped += 1;
    stats.skippedEmpty += 1;
    stats.lastReason = "empty-text";
    void persistStatus(false);
    debugCandidateSkip(element, `empty-text:${settingsVersion}`, { candidateId, reason: "empty-text", trigger });
    return;
  }

  const detachedTarget = hiddenTarget.get(element);
  if (detachedTarget !== undefined && !detachedTarget.isConnected) {
    clearHiddenPresentation(detachedTarget);
    hiddenTarget.delete(element);
    if (hiddenOwner.get(detachedTarget) === element) hiddenOwner.delete(detachedTarget);
    itemStates.delete(element);
  }

  const fingerprint = fingerprintText(text);
  const previous = itemStates.get(element);
  if (previous?.fingerprint === fingerprint && previous.settingsVersion === settingsVersion) {
    stats.skipped += 1;
    stats.skippedUnchanged += 1;
    stats.lastReason = "unchanged";
    void persistStatus(false);
    debugCandidateSkip(element, `unchanged:${settingsVersion}`, { candidateId, reason: "unchanged",
      textLength: text.length, trigger });
    return;
  }

  lastEmptyExtractionReport.set(element, false);
  debugLog("candidate", { candidateId, stage: "extraction", trigger,
    kind: unitKind(element), source: unitSource.get(element) ?? "unknown", via: unitSource.get(element) ?? "unknown",
    textLength: text.length, outcome: "nonempty", connected: element.isConnected,
    nestedUnitsExcluded: true,
    nestedTextIsolated: unitSource.get(element) === "ssr" || element.matches(".native-text") });
  debugLog("candidate", { candidateId, stage: "classification-queued", trigger,
    textLength: text.length, connected: element.isConnected });

  // A changed post invalidates the previous decision immediately; stale async results cannot re-hide it.
  reveal(element, "content-reconsideration");
  const state: ItemState = { fingerprint, settingsVersion };
  itemStates.set(element, state);

  const accepted = queue.enqueue(async () => {
    if (disposed) {
      lifecycleGuard("queue-task-entry");
      return;
    }
    const result = await classify(text, candidateId);
    // The instance may have been disposed while classification was awaited;
    // do not read state or account for a result that can no longer be applied.
    if (disposed) {
      lifecycleGuard("classify-after-dispose");
      return;
    }
    const latest = itemStates.get(element);
    if (!element.isConnected ||
        latest?.fingerprint !== fingerprint ||
        latest.settingsVersion !== settingsVersion ||
        state.settingsVersion !== settingsVersion) {
      debugCandidateSkip(element, `${!element.isConnected ? "disconnected-result" : "stale-result"}:${settingsVersion}`,
        { candidateId, reason: !element.isConnected ? "disconnected-result" : "stale-result",
          connected: element.isConnected, trigger });
      return;
    }
    stats.classified += 1;
    applyResult(element, result, candidateId);
  });

  // If the bounded queue is saturated, allow a later DOM change or settings update to retry.
  if (!accepted) {
    itemStates.delete(element);
    stats.skipped += 1;
    stats.skippedQueueFull += 1;
    stats.lastReason = "queue-full";
    void persistStatus(false);
    debugCandidateSkip(element, `queue-full:${settingsVersion}`,
      { candidateId, reason: "queue-full", trigger });
    return;
  }
  stats.evaluated += 1;
}

export function scan(): void {
  // Counts are collected only while diagnostics are on, so normal filtering
  // does no extra DOM queries.
  const report = debugEnabled ? createDiscoveryReport() : undefined;
  const found = discoverUnits(document, report);
  stats.articlesFound = found.length;
  void persistStatus(false);
  debugLog("scan", { articles: found.length, ...(report ?? {}) });
  for (const element of found) evaluate(element);
}

// One concise, throttled summary per burst instead of a line per mutation.
let lastMutationReportAt = 0;

function processMutations(records: MutationRecord[]): void {
  if (disposed) {
    lifecycleGuard("processMutations");
    return;
  }
  const report = debugEnabled ? createDiscoveryReport() : undefined;
  const affected = new Set<Element>();
  for (const record of records) {
    const parentUnit = contentUnitFor(record.target);
    if (parentUnit) affected.add(parentUnit);
    for (const addedNode of Array.from(record.addedNodes)) {
      const containingUnit = contentUnitFor(addedNode);
      if (containingUnit) affected.add(containingUnit);
      for (const nestedUnit of unitsWithin(addedNode, report)) affected.add(nestedUnit);
    }
  }
  const now = Date.now();
  if (now - lastMutationReportAt >= 1000) {
    lastMutationReportAt = now;
    debugLog("mutations", { batches: records.length, affected: affected.size, ...(report ?? {}) });
  }
  for (const element of affected) evaluate(element, "mutation");
}

async function loadSettings(): Promise<void> {
  if (disposed) {
    lifecycleGuard("loadSettings-entry");
    return;
  }
  let storedDebug: unknown = false;
  try {
    const stored = await chrome.storage.sync.get("tathabbutSettings");
    // A load that started before teardown must not apply after it: bail out
    // before touching state, DOM, or scanning.
    if (disposed) {
      lifecycleGuard("loadSettings-after-sync-read");
      return;
    }
    let localDebug: unknown = false;
    try {
      const localStored = await chrome.storage.local.get(DEBUG_FLAG_KEY);
      localDebug = localStored[DEBUG_FLAG_KEY];
      storedDebug = localDebug;
    } catch {
      // A missing local flag simply leaves diagnostics off.
    }
    // The second read is also a suspension point; recheck before applying.
    if (disposed) {
      lifecycleGuard("loadSettings-after-local-read");
      return;
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
        apiUrl: typeof candidate.apiUrl === "string" ? candidate.apiUrl.trim() : "",
        language: pickLanguage(candidate.language)
      };
    } else {
      settings = { ...DEFAULT_SETTINGS, enabledCategories: [...DEFAULT_SETTINGS.enabledCategories] };
    }
  } catch {
    if (disposed) {
      lifecycleGuard("loadSettings-error-after-dispose");
      return;
    }
    // Keep safe local defaults if extension storage is unavailable.
    stats.settingsOk = false;
  }

  // Final guard before the settings-version bump, reveal loop, and scan,
  // so a torn-down instance never mutates the page or schedules work.
  if (disposed) {
    lifecycleGuard("loadSettings-before-apply");
    return;
  }
  debugEnabled = storedDebug === true || readLocalDebugFlag();
  void persistStatus(true);

  settingsVersion += 1;
  debugLog("settings", {
    enabled: settings.enabled,
    enabledCategories: [...settings.enabledCategories],
    threshold: settings.threshold,
    mode: settings.apiUrl ? "remote" : "local"
  });
  document.querySelectorAll("." + HIDDEN_CLASS).forEach((element) => reveal(element, "settings-change"));
  scan();
}

void loadSettings();

function handleStorageChange(changes: { [key: string]: unknown }, areaName: string): void {
  if (disposed) {
    lifecycleGuard("handleStorageChange");
    return;
  }
  if (areaName === "sync" && changes.tathabbutSettings) void loadSettings();
  else if (areaName === "local" && changes[DEBUG_FLAG_KEY]) void loadSettings();
}

const observer = new MutationObserver(processMutations);

// A content script owns its observer and storage listener for as long as the
// document lives. dispose() is the single teardown point for that ownership: it
// detaches both registrations and marks the instance inert so work it already
// queued cannot keep mutating the DOM. Permanent pagehide binds the same
// teardown to real document unload, and a re-imported module (as tests do) can
// call it explicitly instead of leaking the previous instance's resources.
export function dispose(): void {
  if (disposed) return;
  disposed = true;
  if (progressTimer !== undefined) {
    window.clearTimeout(progressTimer);
    progressTimer = undefined;
  }
  observer.disconnect();
  chrome.storage.onChanged.removeListener(handleStorageChange);
  window.removeEventListener("pagehide", handlePageHide);
  lifecycleLog("dispose", {
    observer: "disconnected",
    storageListener: "removed",
    pagehideListener: "removed"
  });
}

// pagehide fires both for permanent unload and when the document is frozen into
// the back-forward cache. A bfcached document is restored without re-running its
// content script, so disposing on persisted=true would leave filtering dead after
// a restore. Only a real teardown (persisted=false) disposes; keeping the single
// observer/listener registered means a restore needs no reinitialization and
// cannot register duplicates.
function handlePageHide(event: PageTransitionEvent): void {
  const persisted = event.persisted === true;
  lifecycleLog("pagehide", { persisted });
  if (persisted) {
    // A frozen document is restored without re-running the content script, so
    // teardown here would leave filtering dead after a restore.
    lifecycleLog("pagehide:keep-alive");
    return;
  }
  dispose();
}

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true
});
lifecycleLog("observer:observe");

chrome.storage.onChanged.addListener(handleStorageChange);
window.addEventListener("pagehide", handlePageHide);
lifecycleLog("listeners:add", { storage: true, pagehide: true });

void persistStatus(true);
debugLog("loaded", { buildId: __TATHABBUT_DIAGNOSTIC_BUILD_ID__, topFrame: window.top === window });
lifecycleLog("init", { topFrame: window.top === window });
