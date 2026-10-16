// Structured Arabic harassment corpus: direct insults, mockery, and
// belittling as positives; respectful criticism and neutral discussion as
// protected negatives. Rule scores are heuristic values (0.86/0.90), not
// calibrated probabilities. Ambiguous cases stay uncovered by design and
// are asserted as visible, with the reason noted inline.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, classifyLocally, shouldHide } from "./policy";

const AT_DEFAULT = { ...DEFAULT_SETTINGS };
const AT_99 = { ...DEFAULT_SETTINGS, threshold: 0.99 };

function hides(text: string): boolean {
  return shouldHide(classifyLocally(text), AT_DEFAULT);
}

function isHarassment(text: string): boolean {
  return classifyLocally(text).labels.some((label) => label.category === "harassment");
}

describe("direct personal insults", () => {
  it.each([
    "انت غبي",
    "إنت غبي",
    "أنت غبي",
    "انت غبيه",
    "انت غبية",
    "يا غبي",
    "يا غبية",
    "إنت أهبل",
    "يا أهبل",
    "يا هبلة",
    "يا متخلف",
    "يا متخلفة",
    "يا حقير",
    "يا حقيرة",
    "يا جاهل",
    "يا جاهلة",
    "انت فاشل",
    "انت فاشلة",
    "انت تافه",
    "انت تافهة",
    "انت جاهل",
    "انتوا غبي",
    "انتي فاشلة"
  ])("hides a targeted insult: %s", (text) => {
    expect(isHarassment(text)).toBe(true);
    expect(hides(text)).toBe(true);
  });
});

describe("mockery and sarcastic put-downs", () => {
  it.each([
    "عبقري زمانك",
    "أنت عالم زمانك",
    "يا سلام على الذكاء",
    "ما شاء الله على الفهم",
    "فاهم اوي",
    "فاهمه اوي",
    "انت فاكر نفسك مين",
    "إنت فاكر نفسك مين؟"
  ])("hides a distinctive mockery phrase: %s", (text) => {
    expect(isHarassment(text)).toBe(true);
    expect(hides(text)).toBe(true);
  });

  it.each([
    "الذكاء نعمة كبيرة",
    "الفهم مهم للتعلم",
    "العالم مليء بالعجائب",
    "أنا فاهم قصدك",
    "ضحكتني والله يا عالم"
  ])("leaves isolated or ambiguous wording visible: %s", (text) => {
    // Isolated nouns are never harmful alone; the last case is genuine
    // ambiguity (amusement vs mockery) the rules cannot resolve.
    expect(classifyLocally(text).labels).toEqual([]);
    expect(hides(text)).toBe(false);
  });
});

describe("belittling and humiliation", () => {
  it.each([
    "انت مالكش لازمه",
    "انت مالكش لازمة",
    "محدش بياخد بكلامك",
    "انت اخر واحد يتكلم",
    "انت آخر واحد يتكلم",
    "انت متفهمش حاجه",
    "انت متفهمش حاجة",
    "كلامك يضحك"
  ])("hides a targeted put-down: %s", (text) => {
    expect(isHarassment(text)).toBe(true);
    expect(hides(text)).toBe(true);
  });

  it.each([
    "هذا الفشل في التجربة يحتاج إلى تحليل",
    "الفشل جزء من التعلم",
    "انت بتفضح نفسك"
  ])("leaves abstract or teasing wording visible: %s", (text) => {
    // Abstract failure nouns are not personal attacks; teasing between
    // friends is indistinguishable from shaming without context.
    expect(classifyLocally(text).labels).toEqual([]);
  });
});

describe("respectful criticism stays visible", () => {
  it.each([
    "أنا مختلف معاك في الرأي",
    "رأيك مش دقيق ومحتاج دليل",
    "أنا مش مقتنع بكلامك",
    "خلينا نناقش الفكرة بهدوء",
    "أعتقد أن تحليلك غير صحيح",
    "هذا الاستنتاج يحتاج إلى دليل إضافي",
    "التنفيذ فيه أخطاء ويحتاج إلى تحسين",
    "المعلومة دي غير صحيحة"
  ])("does not flag respectful criticism: %s", (text) => {
    expect(classifyLocally(text).labels).toEqual([]);
    expect(hides(text)).toBe(false);
  });
});

describe("neutral discussion stays visible", () => {
  it.each([
    "الجو جميل اليوم",
    "هنروح السينما بكرة؟",
    "يا غباء الدنيا دي",
    "You are an idiot يا غبي"
  ])("handles neutral or mixed text: %s", (text) => {
    // The last case IS harassment (both halves match); the rest are visible.
    if (text.startsWith("You are")) {
      expect(isHarassment(text)).toBe(true);
    } else {
      expect(classifyLocally(text).labels).toEqual([]);
    }
  });
});

describe("hateful or dehumanizing attacks", () => {
  // Annotation rule: a dehumanizing attack targets a protected group or
  // community as vermin/subhuman. Criticism of a group's ideas, policies,
  // or actions is NOT hate under this rule, no matter how heated.
  it.each(["All group are vermin", "Every group are subhuman"])(
    "flags a dehumanizing group attack: %s",
    (text) => {
      expect(classifyLocally(text).labels.map((l) => l.category)).toContain("hate");
      expect(hides(text)).toBe(true);
    }
  );

  it.each([
    "I disagree with this group's policy and voted against it.",
    "This ideology deserves strong criticism.",
  ])("leaves criticism of ideas and policies visible: %s", (text) => {
    expect(classifyLocally(text).labels).toEqual([]);
  });
});

describe("harassment normalization variants", () => {
  it.each([
    "  انت غبي  ",
    "،انت غبي؟",
    "إنتَ غَبِي",
    "انت غــبــي",
    "يا حقيرة!",
    "انت\u200B غبي"
  ])("matches through spacing, punctuation, and invisible marks: %s", (text) => {
    expect(isHarassment(text)).toBe(true);
  });
});

describe("english spam", () => {
  it("flags prize and profit spam", () => {
    const result = classifyLocally("Claim your prize now, DM me to claim");
    expect(result.labels.map((l) => l.category)).toContain("spam");
    expect(hides(result && "Claim your prize now, DM me to claim")).toBe(true);
  });

  it.each(["New blog post about healthy cooking recipes", "Meeting moved to 3pm, see you there"])(
    "leaves benign promotion and logistics visible: %s",
    (text) => {
      expect(classifyLocally(text).labels).toEqual([]);
    }
  );
});

describe("counterspeech stays visible", () => {
  it.each([
    "الشتيمة مش حل، خلينا نتناقش باحترام.",
    "This argument needs stronger evidence.",
  ])("does not flag counterspeech or evidence requests: %s", (text) => {
    expect(classifyLocally(text).labels).toEqual([]);
    expect(hides(text)).toBe(false);
  });
});

describe("harassment threshold and category behavior", () => {
  it("does not hide mockery at a 99% threshold", () => {
    const result = classifyLocally("يا سلام على الذكاء");
    expect(shouldHide(result, AT_DEFAULT)).toBe(true);
    expect(shouldHide(result, AT_99)).toBe(false);
  });

  it("does not hide belittling when harassment is disabled", () => {
    const result = classifyLocally("انت مالكش لازمه");
    expect(shouldHide(result, AT_DEFAULT)).toBe(true);
    expect(shouldHide(result, { ...DEFAULT_SETTINGS, enabledCategories: ["spam"] })).toBe(false);
  });
});
