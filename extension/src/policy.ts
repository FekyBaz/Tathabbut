import { DEFAULT_LANGUAGE, type Language } from "./i18n";
import { EGYPTIAN_ARABIC_PERSONAL_ABUSE_PATTERNS } from "./egyptian-arabic-abuse";

export const CATEGORIES = ["harassment", "hate", "threats", "spam"] as const;

export type Category = (typeof CATEGORIES)[number];

export interface LabelScore {
  category: Category;
  score: number;
}

export interface Classification {
  labels: LabelScore[];
  provider: string;
  matches?: RuleMatch[];
}

export interface RuleMatch {
  category: Category;
  ruleId: string;
  reason: string;
}

export interface UserSettings {
  enabled: boolean;
  enabledCategories: Category[];
  threshold: number;
  apiUrl: string;
  language: Language;
}

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  enabledCategories: ["harassment", "hate", "threats", "spam"],
  threshold: 0.85,
  apiUrl: "",
  language: DEFAULT_LANGUAGE
};

export function normalizeForRules(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    // Remove zero-width and bidi controls that can split copied social-media text.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    // Social feeds mix straight and typographic apostrophes.
    .replace(/[\u2018\u2019\u02BC`´]/g, "'")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

// A reporting/quotation cue means the following text is being described, not
// used as a direct attack. Only classify the portion before the cue: this keeps
// "You are an idiot, he said" harmful while protecting
// He said, "You are an idiot" and Arabic report forms such as قال لي.
const REPORTING_CUE = new RegExp(
  "\\b(?:he|she|they|someone|somebody|people|everyone|my\\s+\\w+)\\s+(?:said|says|told|tells|called|calls|wrote|writes|posted|posts|texted|texts|asked|asks|yelled|yells|screamed|screams|quoted|quotes)\\b" +
  "|\\b(?:post|comment|article|message|text|quote)\\s+(?:says|said|reads|read|contains|contained|uses|used)\\b" +
  "|\\b(?:said|says|told|tells|called|calls|wrote|writes|posted|posts|texted|texts|quoted|quotes)\\s+(?:me|him|her|them|us)\\b" +
  "|(?:نقل\\s+عنه\\s+قوله|نقلت\\s+عنه\\s+قولها|قال\\s+لي|قالت\\s+لي|قال|قالت|كتب|كتبت|وصف|يقال|مثال|كلمة|شتيمة|اهانة|مقال|منشور|تعليق|لغة)" +
  "|\\b(?:howa|heya|homma)\\s+(?:2al|2alet|katab|katbet)\\b",
  "i"
);

// When a quoted segment is surrounded by meta language (a word/term/report,
// a moderation note, or an article), remove the quote before matching. This
// protects reported examples such as The comment "You are an idiot" was
// removed without suppressing direct text that merely mentions a post.
const QUOTE_META_CUE = new RegExp(
  "\\b(?:word|term|phrase|slur|insult|quote|quoted|example|discussion|article|comment|post|message|text|language" +
  "|said|says|told|tells|called|calls|wrote|writes|posted|posts|reported|removed|deleted|moderated" +
  "|unacceptable|offensive|abusive)\\b" +
  "|(?:قال|قالت|كتب|كلمة|شتيمة|اهانة|مقال|منشور|تعليق|لغة|حذف|ازال)",
  "i"
);

// A mention word alone is not enough to suppress later classification. Protect
// an unquoted abuse example only when the sentence explicitly discusses it as
// offensive/abusive language; this avoids truncating unrelated text such as
// "Send your wallet phrase now to unlock guaranteed profit".
const EXPLICIT_ABUSE_DISCUSSION = new RegExp(
  "\\b(?:the\\s+)?(?:word|term|phrase|slur|insult|example)\\b[^.!?؟]{0,120}" +
  "\\b(?:is|was|means|refers\\s+to|can\\s+be|counts\\s+as)\\b[^.!?؟]{0,80}" +
  "\\b(?:insult|insulting|slur|abuse|offensive|abusive|harmful)\\b",
  "i"
);

const QUOTED_SEGMENT = /["“”«»][^"“”«»]*["“”«»]|'[^']*'/g;
const HAS_QUOTED_SEGMENT = /["“”«»][^"“”«»]*["“”«»]|'[^']*'/;

function isOnlyQuotedText(text: string): boolean {
  if (!HAS_QUOTED_SEGMENT.test(text)) return false;
  return text.replace(QUOTED_SEGMENT, "").replace(/[\s،,.!?؟"'“”«»]/g, "") === "";
}

function classificationText(normalized: string): string {
  if (isOnlyQuotedText(normalized)) return "";
  let text = normalized;
  // Do not classify a direct-abuse phrase when the same phrase is explicitly
  // prohibited rather than used (e.g. "متقولش لحد يا علق").
  text = text.replace(
    /(?:متقولش|ما\s+تقولش|ماينفعش\s+تقول|لا\s+تقول)\s+(?:لحد\s+)?يا\s+علق(?=$|[\s،,.!?؟])/gu,
    " "
  );
  if (QUOTE_META_CUE.test(text)) {
    text = text.replace(QUOTED_SEGMENT, " ");
  } else {
    // Quotes used for emphasis around a direct insult: You are an "idiot".
    text = text.replace(/["“”«»]/g, " ");
  }
  const discussion = EXPLICIT_ABUSE_DISCUSSION.exec(text);
  if (discussion) {
    text = text.slice(0, discussion.index) + " " + text.slice(discussion.index + discussion[0].length);
  }
  const cue = REPORTING_CUE.exec(text);
  if (cue) return text.slice(0, cue.index);
  // A narrow reported joke/performance cue protects quoted threats without
  // suppressing direct statements that merely discuss a play or comedy.
  const bodyThreatReport = /\b(?:he|she|they|someone)\s+(?:joked|jokes|quipped)\b(?=[^.!?؟]{0,100}["“”«»'][^.!?؟]{0,100}\b(?:break|smash)\s+(?:your|his|her|their)\s+(?:jaw|nose|arm|leg|hand|finger|neck|ribs)\b)/i.exec(text);
  return bodyThreatReport ? text.slice(0, bodyThreatReport.index) : text;
}

const patterns: Record<Category, RegExp[]> = {
  harassment: [
    // Direct English insults with a second-person target. The optional
    // article/determiner keeps "you are stupid" and "you're such a moron"
    // covered without matching reported or self-directed text.
    /\b(?:you(?:'re| are)|u r)\s+(?:(?:such\s+(?:a|an)\s+)|(?:(?:a|an)\s+)?(?:complete|total)\s+|(?:(?:a|an)\s+)?)?(?:idiot|moron|loser|stupid|dumb|worthless|pathetic|clown|asshole|bastard|piece of (?:shit|trash)|waste of space)\b/i,
    // Direct personal degradation from V5 development: exact target framing
    // plus a narrow set of attested predicates; object/idea criticism is excluded.
    /\b(?:you(?:'re| are))\s+(?:(?:a|an)\s+)?(?:complete\s+|absolute\s+|total\s+)?(?:fraud|joke)\b/i,
    /\b(?:you(?:'re| are))\s+(?:such\s+)?(?:an?\s+)?(?:hopeless\s+)?joke\s+of\s+(?:a|an)\s+(?:coworker|teammate|employee|manager)\b/i,
    /(?:^|[\s،,.!?؟])(?:انت|إنت|انتي|إنتي)\s+(?:fraud|joke|faker)(?=$|[\s،,.!?؟])/iu,
    /\b(?:shut up|nobody cares about you|no one cares about you|everyone hates you|you have no friends)\b/i,
    /\b(?:fuck|screw) you\b/i,
    /(?:^|[\s،,.!?؟])(?:انت|انتي)\s+(?:غبي[هة]?|حمار|فاشل[هة]?)(?=$|[\s،,.!?؟])/u,
    /(?:^|[\s،,.!?؟])يا\s+(?:غبي[هة]?|حمار|فاشل[هة]?)(?=$|[\s،,.!?؟])/u,
    // High-confidence, targeted Egyptian Arabic bullying/put-down phrases.
    /(?:^|[\s،,.!?؟])(?:انت|انتي|انتوا|انتم)\s+(?:غبي[هة]?|اهبل|هبل[هة]?|حمار|فاشل[هة]?|تافه[هة]?|حقير[هة]?|جاهل[هة]?|كلب[هة]?|حيوان[هة]?|بهيم[هة]?|قذر[هة]?|وسخ[هة]?|زبال[هة]?)(?=$|[\s،,.!?؟])/u,
    /(?:^|[\s،,.!?؟])يا\s+(?:اهبل|هبل[هة]?|متخلف[هة]?|تافه[هة]?|حقير[هة]?|جاهل[هة]?|كلب[هة]?|حيوان[هة]?|بهيم[هة]?|قذر[هة]?|وسخ[هة]?|زبال[هة]?)(?=$|[\s،,.!?؟])/u,
    // Whole-message standalone adjectives stay covered, but the same word in a
    // sentence ("هذا سؤال غبي", "أنا غبي أحيانا") is criticism or self-description.
    /^[\s،,.!?؟]*(?:غبي[هة]?|فاشل[هة]?|جاهل)[\s،,.!?؟]*$/u,
    /(?:^|[\s،,.!?؟])(?:اخرس|اسكت)(?:\s+يا\s+\S+)?(?=$|[\s،,.!?؟])/u,
    /(?:^|[\s،,.!?؟])تبا\s+لك(?=$|[\s،,.!?؟])/u,
    /(?:عبقري\s+زمانك|عالم\s+زمانك|يا\s+سلام\s+علي\s+(?:الفهم|الذكاء)|ما\s+شاء\s+الله\s+علي\s+(?:الفهم|الذكاء)|فاهمه?\s+اوي|فاكر\s+نفسك\s+مين)/u,
    // Targeted belittling: possessive or second-person dismissal phrases.
    // Each alternative is a complete multi-word phrase, never a lone word.
    /(?:(?:انت\s+)?(?:مالكش|ملكش)\s+لازم[هة]?|محدش\s+بياخد\s+بكلامك|انت\s+اخر\s+واحد\s+يتكلم|انت\s+متفهمش\s+حاج[هة]?|كلامك\s+يضحك)/u,
    // Narrow, whole-phrase Arabizi forms; avoid treating isolated tokens as abuse.
    /\b(?:enta|inti|entu)\s+(?:ghaby|ghabi|ahbal)\b/i,
    /\benta\s+faker\b/i,
    /\b(?:you(?:'re| are)|u r)\s+اهبل(?=$|[\s،,.!?؟])/iu,
    /\bya\s+(?:7mar|7omar|hamar)\b/i,
    /\bya\s+ahbal\b/i,
    // New, reviewed Egyptian Arabic vocative and explicit second-person insult.
    ...EGYPTIAN_ARABIC_PERSONAL_ABUSE_PATTERNS
  ],
  hate: [
    /\b(?:all|every) (?:members of )?(?:group) are (?:vermin|subhuman)\b/i
  ],
  threats: [
    /\b(?:i will|i'm going to|i am going to|i'll|im gonna|i'm gonna)\s+(?:(?:kill|hurt|attack|punch|stab|shoot|end)\s+(?:you|him|her|them)|beat\s+(?:you|him|her|them)\s+up)\b/i,
    // Narrow future-intent constructions that name a body part as the injury target.
    /\b(?:i will|i am going to|i'm going to|i'll|im gonna|i'm gonna)\s+(?:break|smash)\s+(?:your|his|her|their)\s+(?:jaw|nose|arm|leg|hand|finger|neck|ribs)\b/i,
    /\bkill yourself\b|\bgo kill yourself\b|\bgo die\b/i,
    /(?:^|[\s،,.!?؟])(?:هقتلك|هذبحك|هضربك|هكسرك|بقتلك|ساقتلك|سوف\s+اقتلك|سوف\s+اذيك|اريد\s+قتلك|عايز\s+اقتلك|عاوز\s+اقتلك|(?:راح|رح)\s+اقتلك)(?=$|[\s،,.!?؟])/u,
    /(?:^|[\s،,.!?؟])(?:هقتل|هاذي|هضرب)(?:ه|ها|هم)(?=$|[\s،,.!?؟])/u,
    // Attested Egyptian Arabizi future threats; keep to second-person forms.
    /\b(?:ha2telek|hadrabak|haksarak)\b/i
  ],
  spam: [
    /\b(?:dm me to claim|guaranteed profit|claim your prize now)\b/i,
    /(?:https?:\/\/\S+\s*){4,}/i,
    /(?:^|[\s،,.!?؟])(?:ابعتلي خاص عشان تكسب|اربح الجائزة الان|مبروك كسبت الجائزة)(?=$|[\s،,.!?؟])/u,
    // Mixed-script prize bait: require a reward cue, private solicitation,
    // and a claim/collection action together to protect ordinary messages.
    /(?=.*(?:\b(?:prize|reward|won|claim)\b|جائزة|الجائزة|مبروك\s+كسبت))(?=.*(?:ابعتلي\s+(?:خاص|رسالة\s+خاصة)|\bdm\s+me\s+privately\b))(?=.*(?:تستلم|استلام|claim|collect))/iu,
    // Narrow Arabizi prize claim phrase, with all solicitation parts required.
    /\b(?:(?:mabrook|mabrouk)\s+kasabt|ent[aiu]\s+kasabt(?:y)?)\b(?=.*\b(?:prize|reward|flos|bonus)\b)(?=.*\b(?:eb3atly|eb3atli)\b|ابعتلي\s+خاص|ابعتي\s+خاص)(?=.*\b(?:private|dm)\b|خاص)(?=.*\b(?:testalem\w*|claim|collect)\b|تستلم\w*)/i
  ]
};

export function classifyLocally(text: string): Classification {
  const normalized = normalizeForRules(text);
  const ruleText = classificationText(normalized);
  const labels: LabelScore[] = [];
  const matches: RuleMatch[] = [];
  const reasons: Record<Category, string> = {
    harassment: "Targeted personal abuse phrase matched.",
    hate: "Dehumanizing group attack phrase matched.",
    threats: "Explicit threat or self-harm encouragement phrase matched.",
    spam: "Solicitation or repeated-link spam phrase matched."
  };
  for (const category of CATEGORIES) {
    // Remove only explicit negation forms attested in the development set.
    const threatText = ruleText.replace(
      /(?:^|[\s،,.!?؟])(?:مش|ما)\s+(?:(?:هقتلك|هذبحك|هضربك|هكسرك|هأذيك|هاذيك|هقتل(?:ه|ها|هم)|هضرب(?:ه|ها|هم)))(?:\s+ولا\s+(?:هقتلك|هذبحك|هضربك|هكسرك|هأذيك|هاذيك|هقتل(?:ه|ها|هم)|هضرب(?:ه|ها|هم)))*(?=$|[\s،,.!?؟])/gu,
      " "
    ).replace(/\b(?:ana\s+)?(?:mesh|msh)\s+(?:ha2telek|hadrabak|haksarak)\b/gi, " ");
    const matchText = category === "threats" ? threatText : ruleText;
    const categoryMatches = patterns[category]
      .map((pattern, index) => ({ pattern, index }))
      .filter(({ pattern }) => pattern.test(matchText));
    for (const { index } of categoryMatches) {
      // IDs follow pattern order within each category; append new patterns to
      // preserve existing IDs and keep them useful in diagnostics/evaluation.
      matches.push({ category, ruleId: `${category}.${index + 1}`, reason: reasons[category] });
    }
    if (categoryMatches.length > 0) {
      labels.push({ category, score: category === "threats" ? 0.90 : 0.86 });
    }
  }

  return { labels, provider: "local-heuristic", matches };
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
