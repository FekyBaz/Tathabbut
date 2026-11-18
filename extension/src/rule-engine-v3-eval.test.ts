import { describe, expect, it } from "vitest";
import development from "../../eval/rule-engine-v3-dev.json";
import frozenTest from "../../eval/rule-engine-v3-test.json";
import legacy from "../../eval/dataset.json";
import v1Dev from "../../eval/rule-engine-dev.json";
import v1Test from "../../eval/rule-engine-heldout.json";
import v2Dev from "../../eval/rule-engine-v2-dev.json";
import v2Test from "../../eval/rule-engine-v2-test.json";
import { CATEGORIES, classifyLocally, normalizeForRules, type Category } from "./policy";

interface Example {
  id: string;
  text: string;
  expect: Category[];
  lang: "ar" | "en" | "mixed" | "arabizi";
  status: "clear" | "ambiguous";
  primaryCategory: Category;
  rationale: string;
}

type Cell = { tp: number; fp: number; tn: number; fn: number };
const devItems = development.items as Example[];
const testItems = frozenTest.items as Example[];

function canonical(text: string): string {
  return normalizeForRules(text).toLowerCase()
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي")
    .replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function shingles(text: string): Set<string> {
  const words = canonical(text).split(" ").filter(Boolean);
  return new Set(words.length < 2 ? words : words.slice(0, -1).map((word, i) => `${word} ${words[i + 1]}`));
}

function similarity(a: string, b: string): number {
  const left = shingles(a), right = shingles(b);
  const shared = [...left].filter((part) => right.has(part)).length;
  return shared / new Set([...left, ...right]).size;
}

function predict(text: string): Category[] {
  return CATEGORIES.filter((category) => classifyLocally(text).labels.some((label) => label.category === category));
}

function measure(items: Example[], category: Category, lang?: Example["lang"]): Cell {
  const cell: Cell = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const item of items.filter((entry) => entry.status === "clear" && (!lang || entry.lang === lang))) {
    const actual = item.expect.includes(category), guessed = predict(item.text).includes(category);
    if (actual && guessed) cell.tp++;
    else if (actual) cell.fn++;
    else if (guessed) cell.fp++;
    else cell.tn++;
  }
  return cell;
}

function metric(n: number, d: number): string { return d ? (n / d).toFixed(3) : "n/a"; }

function printMetrics(title: string, items: Example[]): string[] {
  const lines = [`${title}: n=${items.filter((x) => x.status === "clear").length} clear`];
  const errors: string[] = [];
  for (const item of items.filter((x) => x.status === "clear")) {
    const got = predict(item.text);
    if (got.length !== item.expect.length || got.some((x) => !item.expect.includes(x))) {
      errors.push(`${item.id} expected=[${item.expect}] actual=[${got}]`);
    }
  }
  for (const category of CATEGORIES) {
    const c = measure(items, category);
    lines.push(`${category}: pos=${c.tp + c.fn} neg=${c.tn + c.fp} TP=${c.tp} FP=${c.fp} TN=${c.tn} FN=${c.fn} P=${metric(c.tp, c.tp + c.fp)} R=${metric(c.tp, c.tp + c.fn)} F1=${metric(2 * c.tp, 2 * c.tp + c.fp + c.fn)}`);
  }
  for (const lang of ["ar", "en", "mixed", "arabizi"] as const) {
    const subset = items.filter((x) => x.status === "clear" && x.lang === lang);
    const exact = subset.filter((item) => {
      const got = predict(item.text);
      return got.length === item.expect.length && got.every((x) => item.expect.includes(x));
    }).length;
    lines.push(`${lang}: exact=${exact}/${subset.length}`);
    for (const category of CATEGORIES) {
      const c = measure(items, category, lang);
      lines.push(`  ${category}: n=${c.tp + c.fp + c.tn + c.fn} TP=${c.tp} FP=${c.fp} TN=${c.tn} FN=${c.fn} P=${metric(c.tp, c.tp + c.fp)} R=${metric(c.tp, c.tp + c.fn)} F1=${metric(2 * c.tp, 2 * c.tp + c.fp + c.fn)}`);
    }
  }
  lines.push(...errors.map((item) => `error: ${item}`));
  return lines;
}

const previouslySeen = [
  ...(legacy.items as Array<{ id: string; text: string }>),
  ...(v1Dev.items as Array<{ id: string; text: string }>),
  ...(v1Test.items as Array<{ id: string; text: string }>),
  ...(v2Dev.items as Array<{ id: string; text: string }>),
  ...(v2Test.items as Array<{ id: string; text: string }>)
];

describe("rule-engine-v3 cycle integrity and evaluation", () => {
  it("has unique IDs and complete, policy-tagged annotations", () => {
    expect(development.split).toBe("development");
    expect(frozenTest.split).toBe("frozen-test");
    expect(new Set([...devItems, ...testItems].map((x) => x.id)).size).toBe(devItems.length + testItems.length);
    for (const item of [...devItems, ...testItems]) {
      expect(item.text.length).toBeGreaterThan(0);
      expect(item.rationale.length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(item.primaryCategory);
      expect(item.expect.every((category) => CATEGORIES.includes(category))).toBe(true);
      expect(["ar", "en", "mixed", "arabizi"]).toContain(item.lang);
      expect(item.status).toBe("clear");
    }
  });

  it("keeps v3 test distinct from development and all previously scored text", () => {
    const seen = [...previouslySeen, ...devItems];
    for (const old of seen) for (const test of testItems) {
      expect(canonical(old.text), `${old.id} vs ${test.id}`).not.toBe(canonical(test.text));
      expect(similarity(old.text, test.text), `${old.id} vs ${test.id}`).toBeLessThan(0.8);
    }
  });

  it("has positive and matched hard-negative support per category and language", () => {
    for (const items of [devItems, testItems]) for (const category of CATEGORIES) for (const lang of ["ar", "en", "mixed", "arabizi"] as const) {
      const subset = items.filter((x) => x.primaryCategory === category && x.lang === lang);
      expect(subset.filter((x) => x.expect.includes(category)).length).toBeGreaterThanOrEqual(1);
      expect(subset.filter((x) => !x.expect.includes(category)).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("reports development metrics", () => {
    console.log(printMetrics("V3 DEVELOPMENT", devItems).join("\n"));
    expect(devItems.length).toBe(35);
  });

  it("evaluates frozen test only after development decisions are frozen", () => {
    console.log(printMetrics("V3 FROZEN TEST", testItems).join("\n"));
    expect(testItems.length).toBe(32);
  });
});
