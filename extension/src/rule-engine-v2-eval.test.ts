import { describe, expect, it } from "vitest";
import development from "../../eval/rule-engine-v2-dev.json";
import frozenTest from "../../eval/rule-engine-v2-test.json";
import legacy from "../../eval/dataset.json";
import priorDev from "../../eval/rule-engine-dev.json";
import priorTest from "../../eval/rule-engine-heldout.json";
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

function canonical(text: string): string {
  return normalizeForRules(text)
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenShingles(text: string): Set<string> {
  const tokens = canonical(text).split(" ").filter(Boolean);
  if (tokens.length < 2) return new Set(tokens);
  return new Set(tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`));
}

function shingleSimilarity(a: string, b: string): number {
  const left = tokenShingles(a);
  const right = tokenShingles(b);
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 1;
}

function predicted(text: string): Category[] {
  return CATEGORIES.filter((category) => classifyLocally(text).labels.some((label) => label.category === category));
}

function compute(examples: Example[], category: Category, lang?: Example["lang"]): Cell {
  const cell: Cell = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const item of examples.filter((entry) => entry.status === "clear" && (!lang || entry.lang === lang))) {
    const actual = item.expect.includes(category);
    const guessed = predicted(item.text).includes(category);
    if (actual && guessed) cell.tp += 1;
    else if (actual) cell.fn += 1;
    else if (guessed) cell.fp += 1;
    else cell.tn += 1;
  }
  return cell;
}

function metric(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(3);
}

function report(split: string, examples: Example[]): string[] {
  const clear = examples.filter((item) => item.status === "clear");
  const lines = [`${split}: n=${clear.length} clear, ambiguous=${examples.length - clear.length}`];
  for (const category of CATEGORIES) {
    const cell = compute(examples, category);
    const precision = cell.tp + cell.fp ? cell.tp / (cell.tp + cell.fp) : undefined;
    const recall = cell.tp + cell.fn ? cell.tp / (cell.tp + cell.fn) : undefined;
    const f1 = 2 * cell.tp + cell.fp + cell.fn ? 2 * cell.tp / (2 * cell.tp + cell.fp + cell.fn) : undefined;
    lines.push(`${category}: support+${cell.tp + cell.fn} support-${cell.tn + cell.fp} TP=${cell.tp} FP=${cell.fp} TN=${cell.tn} FN=${cell.fn} P=${metric(precision)} R=${metric(recall)} F1=${metric(f1)}`);
  }
  for (const lang of ["ar", "en", "mixed", "arabizi"] as const) {
    const subset = clear.filter((item) => item.lang === lang);
    const exact = subset.filter((item) => {
      const guess = predicted(item.text);
      return guess.length === item.expect.length && guess.every((category) => item.expect.includes(category));
    }).length;
    lines.push(`${lang}: exact=${exact}/${subset.length}`);
    for (const category of CATEGORIES) {
      const cell = compute(examples, category, lang);
      const precision = cell.tp + cell.fp ? cell.tp / (cell.tp + cell.fp) : undefined;
      const recall = cell.tp + cell.fn ? cell.tp / (cell.tp + cell.fn) : undefined;
      const f1 = 2 * cell.tp + cell.fp + cell.fn ? 2 * cell.tp / (2 * cell.tp + cell.fp + cell.fn) : undefined;
      lines.push(`  ${category}: n=${cell.tp + cell.fp + cell.tn + cell.fn} TP=${cell.tp} FP=${cell.fp} TN=${cell.tn} FN=${cell.fn} P=${metric(precision)} R=${metric(recall)} F1=${metric(f1)}`);
    }
  }
  const ambiguous = examples.filter((item) => item.status === "ambiguous");
  const covered = ambiguous.filter((item) => predicted(item.text).includes(item.primaryCategory)).length;
  lines.push(`ambiguous covered=${covered}/${ambiguous.length}`);
  return lines;
}

const devItems = development.items as Example[];
const testItems = frozenTest.items as Example[];

describe("rule-engine-v2 dataset integrity and evaluation", () => {
  it("validates strata, explicit annotations, rationale, and unique IDs", () => {
    expect(development.split).toBe("development");
    expect(frozenTest.split).toBe("frozen-test");
    expect(new Set([...devItems, ...testItems].map((item) => item.id)).size).toBe(devItems.length + testItems.length);
    for (const item of [...devItems, ...testItems]) {
      expect(item.text.length).toBeGreaterThan(0);
      expect(item.rationale.length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(item.primaryCategory);
      expect(item.expect.every((label) => CATEGORIES.includes(label))).toBe(true);
      expect(["ar", "en", "mixed", "arabizi"]).toContain(item.lang);
      expect(item.status).toBe("clear");
    }
  });

  it("rejects exact and near-duplicate leakage between development and frozen test", () => {
    const previouslySeen = [
      ...devItems,
      ...((legacy.items as Array<{ id: string; text: string }>)),
      ...((priorDev.items as Array<{ id: string; text: string }>)),
      ...((priorTest.items as Array<{ id: string; text: string }>))
    ];
    for (const old of previouslySeen) {
      for (const test of testItems) {
        expect(canonical(old.text), `${old.id} vs ${test.id}`).not.toBe(canonical(test.text));
        expect(shingleSimilarity(old.text, test.text), `${old.id} vs ${test.id}`).toBeLessThan(0.8);
      }
    }
    for (const train of devItems) {
      for (const test of testItems) {
        expect(canonical(train.text), `${train.id} vs ${test.id}`).not.toBe(canonical(test.text));
        expect(shingleSimilarity(train.text, test.text), `${train.id} vs ${test.id}`).toBeLessThan(0.8);
      }
    }
  });

  it("has balanced clear positive and hard-negative examples per category", () => {
    for (const items of [devItems, testItems]) {
      for (const category of CATEGORIES) {
        const subset = items.filter((item) => item.primaryCategory === category && item.status === "clear");
        expect(subset.filter((item) => item.expect.includes(category)).length).toBeGreaterThanOrEqual(4);
        expect(subset.filter((item) => !item.expect.includes(category)).length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("reports category and language metrics without tuning assertions", () => {
    console.log([...report("DEV", devItems), ...report("FROZEN TEST", testItems)].join("\n"));
    expect(devItems.length + testItems.length).toBeGreaterThan(0);
  });
});
