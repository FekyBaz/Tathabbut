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

import type { Language } from "./i18n";

const REASON_TEXT_EN: Record<string, string> = {
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

const REASON_TEXT_AR: Record<string, string> = {
  "rule-match": "طابقت قاعدة وأُخفي العنصر.",
  "no-rule-match": "لا قاعدة طابقت النص.",
  "below-threshold": "طابقت قاعدة لكن درجتها تحت العتبة.",
  "category-disabled": "الفئة المطابَقة مغلقة.",
  "filter-disabled": "التصفية مغلقة.",
  "empty-text": "العنصر بلا نص مقروء.",
  "unchanged": "العنصر لم يتغير منذ آخر فحص.",
  "queue-full": "طابور العمل كان ممتلئًا؛ سيُعاد العنصر مع التغيير التالي.",
  "starting": "سكربت المحتوى لم يُنه الفحص الأول بعد."
};

export function describeReason(reason: string, lang: Language = "en"): string {
  const table = lang === "ar" ? REASON_TEXT_AR : REASON_TEXT_EN;
  return table[reason] ?? reason;
}

export function formatStatusAge(updatedAt: number, lang: Language = "en", now: number = Date.now()): string {
  const ageMs = now - updatedAt;
  if (lang === "ar") {
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs < 1000) return "الآن";
    const seconds = Math.floor(ageMs / 1000);
    if (seconds < 60) {
      if (seconds === 1) return "منذ ثانية";
      if (seconds === 2) return "منذ ثانيتين";
      if (seconds <= 10) return "منذ " + seconds + " ثوانٍ";
      return "منذ " + seconds + " ثانية";
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      if (minutes === 1) return "منذ دقيقة";
      if (minutes === 2) return "منذ دقيقتين";
      if (minutes <= 10) return "منذ " + minutes + " دقائق";
      return "منذ " + minutes + " دقيقة";
    }
    return "قديمة (أقدم من ساعة)";
  }
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
  lang: Language = "en",
  now: number = Date.now()
): StatusView {
  if (input.storageError) {
    return {
      started: lang === "ar"
        ? "تعذر قراءة مساحة التشخيص على هذا الجهاز."
        : "Could not read diagnostic storage on this device.",
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
      started: lang === "ar"
        ? "لا يوجد تقرير بعد — افتح فيسبوك ليعمل سكربت المحتوى."
        : "Not reported yet — open Facebook so the content script can run.",
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
    reason: describeReason(snapshot.lastReason, lang),
    skips: lang === "ar"
      ? snapshot.skippedUnchanged + " بلا تغيير · " +
        snapshot.skippedEmpty + " فارغ · " +
        snapshot.skippedDisabled + " والتصفية مغلقة · " +
        snapshot.skippedQueueFull + " ازدحام الطابور"
      : snapshot.skippedUnchanged + " unchanged · " +
        snapshot.skippedEmpty + " empty · " +
        snapshot.skippedDisabled + " disabled · " +
        snapshot.skippedQueueFull + " queue-full",
    updated: formatStatusAge(snapshot.updatedAt, lang, now),
    source: snapshot.origin || (lang === "ar" ? "موقع غير معروف" : "unknown site")
  };
  if (!isFreshStatus(snapshot, now)) {
    return {
      ...known,
      started: lang === "ar"
        ? "بُلغ سابقًا (قديم) — افتح فيسبوك ليحدّث سكربت المحتوى."
        : "Reported earlier (stale) — open Facebook so the content script can update it.",
      settings: DASH
    };
  }
  return {
    ...known,
    started: lang === "ar"
      ? "يعمل منذ " + new Date(snapshot.startedAt).toLocaleTimeString() + "."
      : "Running since " + new Date(snapshot.startedAt).toLocaleTimeString() + ".",
    settings: snapshot.settingsOk
      ? (snapshot.enabled
        ? (lang === "ar" ? "مفعّل" : "on")
        : (lang === "ar" ? "مغلق" : "off")) + " · " + snapshot.apiMode + " · " +
        snapshot.categories + (lang === "ar" ? " فئات · العتبة " : " categories · threshold ") + snapshot.threshold
      : (lang === "ar" ? "الافتراضيات (تعذرت قراءة التخزين)" : "defaults (storage read failed)")
  };
}
