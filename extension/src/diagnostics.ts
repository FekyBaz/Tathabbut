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
  lastReason: string;
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
