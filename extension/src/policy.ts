export const CATEGORIES = ["harassment", "hate", "threats", "spam"] as const;

export type Category = (typeof CATEGORIES)[number];

export interface LabelScore {
  category: Category;
  score: number;
}

export interface Classification {
  labels: LabelScore[];
  provider: string;
}

export interface UserSettings {
  enabled: boolean;
  enabledCategories: Category[];
  threshold: number;
  apiUrl: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  enabledCategories: ["harassment", "hate", "threats", "spam"],
  threshold: 0.85,
  apiUrl: ""
};

function normalizeForRules(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    // Remove zero-width and bidi controls that can split copied social-media text.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

const patterns: Record<Category, RegExp[]> = {
  harassment: [
    /\b(?:you are|you're) (?:a|an) (?:moron|idiot|loser)\b/i,
    /\b(?:shut up|you are pathetic)\b/i,
    /(?:^|[\s،,.!?؟])(?:انت|انتي)\s+(?:غبي|غبيه|حمار|فاشل|فاشله)(?=$|[\s،,.!?؟])/u,
    /(?:^|[\s،,.!?؟])يا\s+(?:غبي|غبيه|حمار|فاشل|فاشله)(?=$|[\s،,.!?؟])/u
  ],
  hate: [
    /\b(?:all|every) (?:members of )?(?:group) are (?:vermin|subhuman)\b/i
  ],
  threats: [
    /\b(?:i will|i'm going to) (?:kill|hurt|attack) you\b/i,
    /\b(?:i will|i'm going to) kill (?:him|her|them)\b/i,
    /(?:^|[\s،,.!?؟])(?:هقتلك|هاذيك|هضربك|سوف\s+اقتلك|سوف\s+اذيك|اريد\s+قتلك|عايز\s+اقتلك|عاوز\s+اقتلك)(?=$|[\s،,.!?؟])/u,
    /(?:^|[\s،,.!?؟])(?:هقتل|هاذي|هضرب)(?:ه|ها|هم)(?=$|[\s،,.!?؟])/u
  ],
  spam: [
    /\b(?:dm me to claim|guaranteed profit|claim your prize now)\b/i,
    /(?:https?:\/\/\S+\s*){4,}/i,
    /(?:^|[\s،,.!?؟])(?:ابعتلي خاص عشان تكسب|اربح الجائزة الان|مبروك كسبت الجائزة)(?=$|[\s،,.!?؟])/u
  ]
};

export function classifyLocally(text: string): Classification {
  const normalized = normalizeForRules(text);
  const labels: LabelScore[] = [];
  for (const category of CATEGORIES) {
    if (patterns[category].some((pattern) => pattern.test(normalized))) {
      labels.push({ category, score: category === "threats" ? 0.90 : 0.86 });
    }
  }
  return { labels, provider: "local-heuristic" };
}

export function shouldHide(result: Classification, settings: UserSettings): boolean {
  if (!settings.enabled) return false;
  if (!Number.isFinite(settings.threshold) || settings.threshold < 0 || settings.threshold > 1) return false;
  return result.labels.some((label) =>
    CATEGORIES.includes(label.category) &&
    settings.enabledCategories.includes(label.category) &&
    Number.isFinite(label.score) &&
    label.score >= 0 &&
    label.score <= 1 &&
    label.score >= settings.threshold
  );
}

export function isUsableRemoteClassification(value: unknown): value is Classification {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Classification>;
  if (!Array.isArray(candidate.labels) || typeof candidate.provider !== "string") return false;
  return candidate.labels.every((label) => {
    if (!label || typeof label !== "object") return false;
    const item = label as Partial<LabelScore>;
    return typeof item.category === "string" &&
      (CATEGORIES as readonly string[]).includes(item.category) &&
      typeof item.score === "number" &&
      Number.isFinite(item.score) &&
      item.score >= 0 &&
      item.score <= 1;
  });
}
