export const DEBUG_FLAG_KEY = "tathabbutDebug";
export const STATUS_KEY = "tathabbutStatus";

export const STATUS_FRESH_MS = 5 * 60 * 1000;

export interface ContentStatus {
  startedAt: number;
  settingsOk: boolean;
  enabled: boolean;
  threshold: number;
  categories: number;
  apiMode: "local" | "remote";
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
  /** Hostname only (e.g. www.facebook.com). Never paths or profile names. */
  origin: string;
  updatedAt: number;
}

const REASON_TEXT: Record<string, string> = {
  "rule-match": "A rule matched and the item was hidden.",
  "no-rule-match": "No rule matched the text.",
  "below-threshold": "A rule matched, but its score is under the threshold.",
  "category-disabled": "The matched category is switched off.",
  "filter-disabled": "Filtering is switched off.",
  "empty-text": "The item had no readable text.",
  "unchanged": "The item did not change since the last check.",
  "queue-full": "The work queue was full; the item will retry on the next change.",
  "starting": "The content script has not finished its first check yet."
};

export function describeReason(reason: string): string {
  return REASON_TEXT[reason] ?? reason;
}

export function formatStatusAge(updatedAt: number, now: number = Date.now()): string {
  const ageMs = now - updatedAt;
  if (!Number.isFinite(ageMs) || ageMs < 0) return "just now";
  if (ageMs < 5000) return "just now";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  return "stale (over an hour old)";
}

export function isFreshStatus(
  status: ContentStatus | undefined,
  now: number = Date.now(),
  maxAgeMs: number = STATUS_FRESH_MS
): boolean {
  if (!status || typeof status.updatedAt !== "number") return false;
  const age = now - status.updatedAt;
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}

export interface StatusView {
  started: string;
  settings: string;
  articles: string;
  counts: string;
  reason: string;
  updated: string;
  source: string;
  skips: string;
}

const DASH = "—";

/**
 * Pure presentation mapping for the popup panel, so the "what does the
 * user see?" logic is unit-tested: missing snapshots, stale snapshots,
 * and storage failures each produce distinct, honest text. A snapshot can
 * only be attributed to the most recently writing tab — exact tabs would
 * need extra browser permissions, so the panel says so instead.
 */
export function statusViewModel(
  input: { snapshot?: ContentStatus; storageError: boolean },
  now: number = Date.now()
): StatusView {
  if (input.storageError) {
    return {
      started: "Could not read diagnostic storage on this device.",
      settings: DASH,
      articles: DASH,
      counts: DASH,
      reason: DASH,
      updated: DASH,
      source: DASH,
      skips: DASH
    };
  }
  const snapshot = input.snapshot;
  if (!snapshot) {
    return {
      started: "Not reported yet — open Facebook so the content script can run.",
      settings: DASH,
      articles: DASH,
      counts: DASH,
      reason: DASH,
      updated: DASH,
      source: DASH,
      skips: DASH
    };
  }
  const known: Omit<StatusView, "started" | "settings"> = {
    articles: String(snapshot.articlesFound),
    counts:
      snapshot.evaluated + " / " + snapshot.classified + " / " + snapshot.hidden + " / " + snapshot.skipped,
    reason: describeReason(snapshot.lastReason),
    skips:
      snapshot.skippedUnchanged + " unchanged · " +
      snapshot.skippedEmpty + " empty · " +
      snapshot.skippedDisabled + " disabled · " +
      snapshot.skippedQueueFull + " queue-full",
    updated: formatStatusAge(snapshot.updatedAt, now),
    source: snapshot.origin || "unknown site"
  };
  if (!isFreshStatus(snapshot, now)) {
    return {
      ...known,
      started: "Reported earlier (stale) — open Facebook so the content script can update it.",
      settings: DASH
    };
  }
  return {
    ...known,
    started: "Running since " + new Date(snapshot.startedAt).toLocaleTimeString() + ".",
    settings: snapshot.settingsOk
      ? (snapshot.enabled ? "on" : "off") + " · " + snapshot.apiMode + " · " +
        snapshot.categories + " categories · threshold " + snapshot.threshold
      : "defaults (storage read failed)"
  };
}
