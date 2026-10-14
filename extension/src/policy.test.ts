import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, classifyLocally, isUsableRemoteClassification, normalizeForRules, shouldHide } from "./policy";

describe("classifyLocally", () => {
  it("detects a narrow direct English insult example", () => {
    expect(classifyLocally("You are an idiot").labels.map((label) => label.category)).toContain("harassment");
  });
  it("detects a narrow direct Arabic insult after normalization", () => {
    expect(classifyLocally("إنتَ غَبِي").labels.map((label) => label.category)).toContain("harassment");
  });
  it("detects an explicit Arabic threat example", () => {
    expect(classifyLocally("هقتلك").labels.map((label) => label.category)).toContain("threats");
  });
  it("detects a narrow Arabic prize-spam phrase", () => {
    expect(classifyLocally("مبروك كسبت الجائزة").labels.map((label) => label.category)).toContain("spam");
  });
  it("does not classify respectful English criticism by default", () => {
    expect(classifyLocally("I disagree with this policy and think it should change.").labels).toEqual([]);
  });
  it("does not classify respectful Arabic criticism by default", () => {
    expect(classifyLocally("أنا مختلف مع القرار وأعتقد أنه يحتاج إلى تغيير.").labels).toEqual([]);
  });
  it("does not classify uncertainty as misinformation", () => {
    expect(classifyLocally("I am not sure whether this claim is accurate.").labels).toEqual([]);
  });
});

describe("shouldHide", () => {
  it("does not hide when filtering is disabled", () => {
    expect(shouldHide({ labels: [{ category: "harassment", score: 0.99 }], provider: "test" }, {
      ...DEFAULT_SETTINGS, enabled: false
    })).toBe(false);
  });
  it("respects category selection and threshold", () => {
    expect(shouldHide({ labels: [{ category: "harassment", score: 0.70 }], provider: "test" }, {
      ...DEFAULT_SETTINGS, threshold: 0.85
    })).toBe(false);
  });
});

it("rejects unknown remote categories and invalid scores", () => {
  expect(isUsableRemoteClassification({ labels: [{ category: "misinformation", score: 0.9 }], provider: "test" })).toBe(false);
  expect(isUsableRemoteClassification({ labels: [{ category: "spam", score: 8 }], provider: "test" })).toBe(false);
});

describe("regression and decision boundaries", () => {
  it("flags the hamza spelling of the prize-spam phrase after normalization", () => {
    expect(classifyLocally("\u0627\u0631\u0628\u062d \u0627\u0644\u062c\u0627\u0626\u0632\u0629 \u0627\u0644\u0622\u0646").labels.map((label) => label.category)).toContain("spam");
  });
  it("flags plain and alef-variant Arabic insult spellings", () => {
    for (const text of ["\u0627\u0646\u062a \u063a\u0628\u064a", "\u0623\u0646\u062a \u063a\u0628\u064a", "\u0625\u0646\u062a\u064e \u063a\u064e\u0628\u0650\u064a"]) {
      expect(classifyLocally(text).labels.map((label) => label.category)).toContain("harassment");
    }
  });
  it("applies the threshold as an inclusive boundary", () => {
    expect(shouldHide({ labels: [{ category: "harassment", score: 0.85 }], provider: "test" }, { ...DEFAULT_SETTINGS, threshold: 0.85 })).toBe(true);
    expect(shouldHide({ labels: [{ category: "harassment", score: 0.85 }], provider: "test" }, { ...DEFAULT_SETTINGS, threshold: 0.86 })).toBe(false);
  });
  it("refuses invalid thresholds and out-of-range scores", () => {
    expect(shouldHide({ labels: [{ category: "harassment", score: 0.99 }], provider: "test" }, { ...DEFAULT_SETTINGS, threshold: Number.NaN })).toBe(false);
    expect(shouldHide({ labels: [{ category: "harassment", score: 2 }], provider: "test" }, DEFAULT_SETTINGS)).toBe(false);
    expect(shouldHide({ labels: [{ category: "harassment", score: Number.NaN }], provider: "test" }, DEFAULT_SETTINGS)).toBe(false);
    expect(shouldHide({ labels: [{ category: "harassment", score: 0.99 }], provider: "test" }, { ...DEFAULT_SETTINGS, threshold: 2 })).toBe(false);
  });
  it("ignores disabled categories and malformed remote payloads", () => {
    expect(shouldHide({ labels: [{ category: "spam", score: 0.99 }], provider: "test" }, { ...DEFAULT_SETTINGS, enabledCategories: ["harassment"] })).toBe(false);
    expect(isUsableRemoteClassification({ labels: [{ category: "harassment", score: Number.NaN }], provider: "test" })).toBe(false);
    expect(isUsableRemoteClassification({ labels: [], provider: 42 })).toBe(false);
  });
});

describe("hide decision for a clear rule match", () => {
  it("hides when the category is enabled and the threshold fits the rule score", () => {
    const result = classifyLocally("You are an idiot");
    expect(result.labels.map((label) => label.category)).toContain("harassment");
    expect(shouldHide(result, { ...DEFAULT_SETTINGS, threshold: 0.85 })).toBe(true);
  });
  it("does not hide the same match at a 99% threshold", () => {
    const result = classifyLocally("You are an idiot");
    // Stock local scores top out at 0.90, so 0.99 hides nothing by design.
    expect(shouldHide(result, { ...DEFAULT_SETTINGS, threshold: 0.99 })).toBe(false);
  });
});

describe("live controlled examples", () => {
  it("does not match shouty FREE/CLICK-NOW text with the starter spam rules", () => {
    // Deliberately narrow: "free" and "click now" alone match no rule, so
    // this stays visible instead of punishing ordinary promo-looking text.
    expect(classifyLocally("FREE FREE FREE CLICK NOW CLICK NOW CLICK NOW").labels).toEqual([]);
  });
  it("matches Arabic threats even when invisible Unicode marks split the phrase", () => {
    for (const text of ["سوف\u200B اقتلك", "سوف اقتل\u200Fك", "سوف\u2060 اقتلك"]) {
      const result = classifyLocally(text);
      expect(result.labels.map((label) => label.category)).toContain("threats");
      expect(shouldHide(result, { ...DEFAULT_SETTINGS, threshold: 0.85 })).toBe(true);
    }
  });
  it("flags an explicit kill threat and hides it at the default threshold", () => {
    const result = classifyLocally("I will kill you.");
    expect(result.labels.map((label) => label.category)).toContain("threats");
    expect(shouldHide(result, { ...DEFAULT_SETTINGS, threshold: 0.85 })).toBe(true);
  });
  it("flags a direct insult and hides it at the default threshold", () => {
    const result = classifyLocally("You are an idiot.");
    expect(result.labels.map((label) => label.category)).toContain("harassment");
    expect(shouldHide(result, { ...DEFAULT_SETTINGS, threshold: 0.85 })).toBe(true);
  });
  it("does not hide the exact respectful-disagreement control", () => {
    expect(classifyLocally("I respectfully disagree with your opinion.").labels).toEqual([]);
  });
  it("a disabled category beats a real match", () => {
    const result = classifyLocally("You are an idiot.");
    expect(shouldHide(result, { ...DEFAULT_SETTINGS, enabledCategories: ["spam"] })).toBe(false);
    expect(shouldHide(result, DEFAULT_SETTINGS)).toBe(true);
  });
});

describe("arabic normalization", () => {
  it("strips tatweel before matching", () => {
    expect(classifyLocally("\u0627\u0646\u062a \u063a\u0640\u0640\u0628\u0640\u0640\u064a").labels.map((l) => l.category)).toContain("harassment");
  });
  it("normalizes diacritics and alef variants", () => {
    expect(classifyLocally("\u0625\u0650\u0646\u0652\u062a\u064e \u063a\u064e\u0628\u0650\u064a").labels.map((l) => l.category)).toContain("harassment");
    expect(classifyLocally("\u0623\u0646\u062a \u063a\u0628\u064a").labels.map((l) => l.category)).toContain("harassment");
  });
  it("normalizes alef-maqsura before matching", () => {
    expect(classifyLocally("\u0627\u0646\u062a \u063a\u0628\u0649").labels.map((l) => l.category)).toContain("harassment");
  });
});

describe("Arabic bullying, mockery, and personal put-downs", () => {
  it.each([
    "انت غبي",
    "إنت أهبل",
    "يا متخلف",
    "يا حقير",
    "عبقري زمانك",
    "يا سلام على الذكاء",
    "ما شاء الله على الفهم",
    "فاهم اوي"
  ])("flags a targeted bullying or mockery phrase: %s", (text) => {
    const result = classifyLocally(text);
    expect(result.labels.map((label) => label.category)).toContain("harassment");
    expect(shouldHide(result, { ...DEFAULT_SETTINGS, threshold: 0.85 })).toBe(true);
  });

  it.each([
    "أنا مختلف معاك في الرأي",
    "رأيك مش دقيق ومحتاج دليل",
    "أنا مش مقتنع بكلامك",
    "خلينا نناقش الفكرة بهدوء"
  ])("keeps criticism without a personal attack visible: %s", (text) => {
    expect(classifyLocally(text).labels).toEqual([]);
  });
});

describe("Egyptian Arabic threat variants", () => {
  it.each(["اريد قتلك", "أريد قتلك", "عايز اقتلك", "عاوز اقتلك", "سوف اقتلك", "سوف أقتلك"])(
    "classifies the explicit threat variant: %s",
    (text) => {
      const result = classifyLocally(text);
      expect(result.labels.map((label) => label.category)).toContain("threats");
      expect(shouldHide(result, { ...DEFAULT_SETTINGS, threshold: 0.85 })).toBe(true);
    }
  );
});

describe("live arabic threat سوف أقتلك", () => {
  // Proven live case: the classifier matches all common spellings.
  // If this text stays visible live, the cause is discovery
  // (e.g. a standalone comment with no article ancestor), not rules.
  it.each(["\u0633\u0648\u0641 \u0623\u0642\u062a\u0644\u0643", "\u0633\u0648\u0641 \u0627\u0642\u062a\u0644\u0643", "\u0633\u0648\u0641 \u0623\u0642\u062a\u0644\u0643.", "\u0623\u0646\u0627 \u0633\u0648\u0641 \u0623\u0642\u062a\u0644\u0643"])(
    "flags %s as a threat hidden at 0.85",
    (text) => {
      const result = classifyLocally(text);
      expect(result.labels.map((label) => label.category)).toContain("threats");
      expect(shouldHide(result, { ...DEFAULT_SETTINGS, threshold: 0.85 })).toBe(true);
    }
  );
});

describe("normalization contract for rule authors", () => {
  // Patterns run against normalized text, so literals must use the
  // normalized spelling. This test locks the mapping that previously
  // broke the على-spelled mockery rules (normalized على is علي).
  it("maps alef-maqsura to ya", () => {
    expect(normalizeForRules("على")).toBe("علي");
  });
  it("maps alef-with-madda to plain alef", () => {
    expect(normalizeForRules("الآن")).toBe("الان");
  });
  it("strips diacritics, tatweel, and invisible controls", () => {
    expect(normalizeForRules("إِنْتَ")).toBe("انت");
    expect(normalizeForRules("غــبــي")).toBe("غبي");
    expect(normalizeForRules("سوف\u200B أقتلك")).toBe("سوف اقتلك");
  });
});
