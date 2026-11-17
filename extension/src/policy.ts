import { DEFAULT_LANGUAGE, type Language } from "./i18n";
import { EGYPTIAN_ARABIC_PERSONAL_ABUSE_PATTERNS } from "./egyptian-arabic-abuse";

export const CATEGORIES = ["harassment", "hate", "threats", "spam"] as const;

export type Category = (typeof CATEGORIES)[number];
export type PolicyAction = "ALLOW" | "HIDE" | "REVIEW";
export type RuleSpecificity = "high" | "contextual";

export interface LabelScore {
  category: Category;
  score: number;
}

export interface Classification {
  labels: LabelScore[];
  provider: "local-heuristic";
  matches: RuleMatch[];
}

export interface RuleMatch {
  category: Category;
  ruleId: string;
  reason: string;
  specificity: RuleSpecificity;
}

export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
  categories: Category[];
  ruleIds: string[];
}

export interface UserSettings {
  enabled: boolean;
  enabledCategories: Category[];
  threshold: number;
  language: Language;
}

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  enabledCategories: ["harassment", "hate", "threats", "spam"],
  threshold: 0.85,
  language: DEFAULT_LANGUAGE
};

// This preserves the legacy score/threshold API. Local constants are rule
// routing values, not calibrated probabilities. Specificity controls whether
// evidence may auto-hide or must abstain to REVIEW.
const CONTEXTUAL_RULE_IDS: ReadonlySet<string> = new Set([
  "harassment.14", // sarcasm/mockery without an explicit addressee
  "hate.1",        // placeholder word "group" does not identify an identity
  "spam.1",        // a generic phrase can also occur in legitimate promotion
  "spam.3"         // a prize phrase alone lacks solicitation/deception context
]);

const CONTEXTUAL_RULE_REASONS: Readonly<Record<string, string>> = {
  "harassment.14": "Mockery phrase is context-dependent and has no explicit target.",
  "hate.1": "The literal group placeholder does not identify a protected group.",
  "spam.1": "Generic promotion wording lacks enough evidence for automatic spam hiding.",
  "spam.3": "Prize wording alone does not establish deceptive or unsolicited solicitation."
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
  "|\\b(?:howa|heya|homma)\\s+(?:2al|2alet|katab|katbet)\\b" +
  // Third-person cognition attribution (V8): "She thinks he's an idiot" is
  // reported opinion, not an authored attack. First-person cognition ("I think
  // you're an idiot") stays authored because the pronouns exclude I/we.
  "|\\b(?:he|she|they)\\s+(?:thinks?|believes?|claims?)\\b",
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

function removeSentenceLocalCues(text: string, cuePattern: RegExp): string {
  return text.split(/(?<=[.!?؟\n])/u).map((sentence) => {
    const cue = cuePattern.exec(sentence);
    cuePattern.lastIndex = 0;
    if (!cue) return sentence;
    // A first-person author clause such as "I told him you're pathetic" is
    // authored speech, not third-party reporting. Do not truncate it at the
    // embedded reporting verb; the target-specific rules can assess the rest.
    const lead = sentence.slice(0, cue.index);
    if (/(?:^|\bthen\s+)i\s*$/i.test(lead) || /(?:^|\s)(?:انا|احنا)\s*$/u.test(lead)) return sentence;
    return lead;
  }).join(" ");
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
    // Preserve a sentence boundary when a quoted segment ends with terminal
    // punctuation: eating the period would merge the reported sentence with a
    // later authored sentence and let the report cue suppress both (V8 fix).
    text = text.replace(QUOTED_SEGMENT, (segment) =>
      /[.!?؟]\s*['""«»]\s*$/.test(segment) ? " ." : " ");
  } else {
    // Quotes used for emphasis around a direct insult: You are an "idiot".
    text = text.replace(/["“”«»]/g, " ");
  }
  const discussion = EXPLICIT_ABUSE_DISCUSSION.exec(text);
  if (discussion) {
    text = text.slice(0, discussion.index) + " " + text.slice(discussion.index + discussion[0].length);
  }
  // Attribution suppresses only the sentence it governs. A report earlier in
  // a multi-sentence comment must not erase a later authored attack.
  text = removeSentenceLocalCues(text, REPORTING_CUE);
  // A narrow reported joke/performance cue protects quoted threats without
  // suppressing direct statements that merely discuss a play or comedy.
  const bodyThreatReport = /\b(?:he|she|they|someone)\s+(?:joked|jokes|quipped)\b(?=[^.!?؟]{0,100}["“”«»'][^.!?؟]{0,100}\b(?:break|smash)\s+(?:your|his|her|their)\s+(?:jaw|nose|arm|leg|hand|finger|neck|ribs)\b)/i;
  return removeSentenceLocalCues(text, bodyThreatReport);
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
    ...EGYPTIAN_ARABIC_PERSONAL_ABUSE_PATTERNS,
    // V8 third-person authored abuse: the pronoun supplies the personal target
    // exactly as the second-person forms above do. The insult must follow the
    // pronoun directly (intensifiers allowed), so object/idea criticism,
    // possessive subjects, and negation stay protected.
    /\b(?:he(?:'s| is)|she(?:'s| is))\s+(?:(?:such\s+(?:a|an)\s+)|(?:(?:a|an)\s+)?(?:complete|total)\s+|(?:(?:a|an)\s+)?)?(?:idiot|moron|loser|stupid|dumb|worthless|pathetic|clown|asshole|bastard|piece of (?:shit|trash)|waste of space)\b/i,
    /(?:^|[\s،,.!?؟])(?:و)?(?:هو|هي)\s+(?:غبي[هة]?|اهبل|هبل[هة]?|حمار|فاشل[هة]?|تافه[هة]?|حقير[هة]?|جاهل[هة]?|كلب[هة]?|حيوان[هة]?|بهيم[هة]?|قذر[هة]?|وسخ[هة]?|زبال[هة]?)(?=$|[\s،,.!?؟])/u
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
    let categoryMatched = false;
    for (let index = 0; index < patterns[category].length; index += 1) {
      const pattern = patterns[category][index];
      if (!pattern.test(matchText)) continue;
      // IDs follow pattern order within each category; append new patterns to
      // preserve existing IDs and keep them useful in diagnostics/evaluation.
      const ruleId = `${category}.${index + 1}`;
      const hasExplicitArabicAddressee = category === "harassment" && ruleId === "harassment.14" &&
        /(?:^|[\s،,.!?؟])(?:انت|انتي|انتوا|انتم)\s+/u.test(matchText);
      const hasPrizeAndPrivateSolicitation = category === "spam" && ruleId === "spam.1" &&
        /\b(?:prize|reward|won)\b|جائزة|الجائزة|مبروك\s+كسبت/iu.test(matchText) &&
        /\b(?:dm|message)\s+me\b|ابعتلي\s+(?:خاص|رسالة\s+خاصة)/iu.test(matchText);
      const specificity: RuleSpecificity = CONTEXTUAL_RULE_IDS.has(ruleId) &&
        !hasExplicitArabicAddressee && !hasPrizeAndPrivateSolicitation
        ? "contextual" : "high";
      matches.push({ category, ruleId, specificity,
        reason: CONTEXTUAL_RULE_REASONS[ruleId] ?? reasons[category] });
      categoryMatched = true;
    }
    if (categoryMatched) labels.push({ category, score: category === "threats" ? 0.90 : 0.86 });
  }

  return { labels, provider: "local-heuristic", matches };
}

export function decidePolicy(result: Classification, settings: UserSettings): PolicyDecision {
  // Only locally produced rule evidence is accepted by the Stable policy.
  // This rejects legacy or externally supplied classifications before they
  // can affect any action or diagnostic reason.
  if (result.provider !== "local-heuristic" || !Array.isArray(result.matches)) {
    return { action: "ALLOW", reason: "non-local-classification", categories: [], ruleIds: [] };
  }
  if (!settings.enabled) return { action: "ALLOW", reason: "filter-disabled", categories: [], ruleIds: [] };
  if (!Number.isFinite(settings.threshold) || settings.threshold < 0 || settings.threshold > 1) {
    return { action: "ALLOW", reason: "invalid-rule-threshold", categories: [], ruleIds: [] };
  }

  const valid = result.labels.filter((label) => CATEGORIES.includes(label.category) &&
    Number.isFinite(label.score) && label.score >= 0 && label.score <= 1 &&
    settings.enabledCategories.includes(label.category));
  if (valid.length === 0) {
    const disabledMatch = result.labels.some((label) => CATEGORIES.includes(label.category));
    return { action: "ALLOW", reason: disabledMatch ? "category-disabled" : "no-rule-match", categories: [], ruleIds: [] };
  }

  const aboveThreshold = valid.filter((label) => label.score >= settings.threshold);
  if (aboveThreshold.length === 0) {
    return { action: "REVIEW", reason: "below-threshold",
      categories: [...new Set(valid.map((label) => label.category))],
      ruleIds: result.matches.map((match) => match.ruleId) };
  }

  const eligible = new Set(aboveThreshold.map((label) => label.category));
  const evidence = result.matches.filter((match) => eligible.has(match.category));
  const highSpecificity = evidence.filter((match) => match.specificity === "high");
  if (highSpecificity.length > 0) {
    return { action: "HIDE", reason: "rule-match",
      categories: [...new Set(highSpecificity.map((match) => match.category))],
      ruleIds: highSpecificity.map((match) => match.ruleId) };
  }
  return { action: "REVIEW", reason: "contextual-rule-match",
    categories: [...new Set(evidence.map((match) => match.category))],
    ruleIds: evidence.map((match) => match.ruleId) };
}

export function shouldHide(result: Classification, settings: UserSettings): boolean {
  return decidePolicy(result, settings).action === "HIDE";
}
