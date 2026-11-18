import { describe, expect, it } from "vitest";
import development from "../../eval/rule-engine-v4-dev.json";
import frozenTest from "../../eval/rule-engine-v4-test.json";
import legacy from "../../eval/dataset.json";
import v1Dev from "../../eval/rule-engine-dev.json";
import v1Test from "../../eval/rule-engine-heldout.json";
import v2Dev from "../../eval/rule-engine-v2-dev.json";
import v2Test from "../../eval/rule-engine-v2-test.json";
import v3Dev from "../../eval/rule-engine-v3-dev.json";
import v3Test from "../../eval/rule-engine-v3-test.json";
import { CATEGORIES, classifyLocally, normalizeForRules, type Category } from "./policy";

interface Example { id: string; text: string; expect: Category[]; lang: "ar" | "en" | "mixed" | "arabizi"; status: "clear" | "ambiguous"; primaryCategory: Category; rationale: string; provenance: string }
type Cell = { tp: number; fp: number; tn: number; fn: number };
const dev = development.items as Example[];
const test = frozenTest.items as Example[];
const old = [legacy, v1Dev, v1Test, v2Dev, v2Test, v3Dev, v3Test].flatMap((set) => set.items as Example[]);

function canonical(text: string): string {
  return normalizeForRules(text).toLowerCase().replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
}
function shingles(text: string): Set<string> {
  const words = canonical(text).split(" ").filter(Boolean);
  return new Set(words.length < 2 ? words : words.slice(0, -1).map((word, i) => `${word} ${words[i + 1]}`));
}
function similarity(a: string, b: string): number {
  const x = shingles(a), y = shingles(b), overlap = [...x].filter((s) => y.has(s)).length;
  return overlap / new Set([...x, ...y]).size;
}
function predict(text: string): Category[] {
  const labels = classifyLocally(text).labels.map((x) => x.category);
  return CATEGORIES.filter((category) => labels.includes(category));
}
function measure(items: Example[], category: Category, lang?: Example["lang"]): Cell {
  const c: Cell = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const item of items.filter((x) => x.status === "clear" && (!lang || x.lang === lang))) {
    const actual = item.expect.includes(category), got = predict(item.text).includes(category);
    if (actual && got) c.tp++; else if (actual) c.fn++; else if (got) c.fp++; else c.tn++;
  }
  return c;
}
function metrics(name: string, items: Example[]): string[] {
  const lines = [`${name}: clear=${items.filter((x) => x.status === "clear").length}; ambiguous=${items.filter((x) => x.status === "ambiguous").length}`];
  for (const category of CATEGORIES) {
    const c = measure(items, category);
    const p = c.tp + c.fp ? (c.tp / (c.tp + c.fp)).toFixed(3) : "n/a";
    const r = c.tp + c.fn ? (c.tp / (c.tp + c.fn)).toFixed(3) : "n/a";
    const f = 2 * c.tp + c.fp + c.fn ? (2 * c.tp / (2 * c.tp + c.fp + c.fn)).toFixed(3) : "n/a";
    lines.push(`${category}: pos=${c.tp + c.fn} neg=${c.tn + c.fp} TP=${c.tp} FP=${c.fp} TN=${c.tn} FN=${c.fn} P=${p} R=${r} F1=${f}`);
  }
  for (const lang of ["ar", "en", "mixed", "arabizi"] as const) {
    const slice = items.filter((x) => x.lang === lang && x.status === "clear");
    lines.push(`${lang}: n=${slice.length}`);
    for (const category of CATEGORIES) {
      const c = measure(items, category, lang);
      lines.push(`  ${category}: n=${c.tp + c.fp + c.tn + c.fn} TP=${c.tp} FP=${c.fp} TN=${c.tn} FN=${c.fn}`);
    }
  }
  for (const item of items.filter((x) => x.status === "clear")) {
    const got = predict(item.text);
    if (got.length !== item.expect.length || got.some((x) => !item.expect.includes(x))) lines.push(`error: ${item.id} ${item.primaryCategory} expected=[${item.expect}] actual=[${got}]`);
  }
  return lines;
}

describe("rule-engine-v4 cycle integrity and evaluation", () => {
  it("has complete annotations, provenance, unique IDs, and distinct splits", () => {
    expect(development.split).toBe("development");
    expect(frozenTest.split).toBe("frozen-test");
    expect(new Set([...dev, ...test].map((x) => x.id)).size).toBe(dev.length + test.length);
    for (const item of [...dev, ...test]) {
      expect(item.text.length).toBeGreaterThan(0); expect(item.rationale.length).toBeGreaterThan(0);
      expect(item.provenance.length).toBeGreaterThan(0); expect(CATEGORIES).toContain(item.primaryCategory);
      expect(item.expect.every((x) => CATEGORIES.includes(x))).toBe(true); expect(item.status).toBe("clear");
    }
  });
  it("keeps V4 test free of exact and near duplicates from development and all prior corpora", () => {
    for (const before of [...old, ...dev]) for (const item of test) {
      expect(canonical(before.text), `${before.id} vs ${item.id}`).not.toBe(canonical(item.text));
      expect(similarity(before.text, item.text), `${before.id} vs ${item.id}`).toBeLessThan(0.8);
    }
  });
  it("keeps both V4 splits duplicate-free", () => {
    for (let i = 0; i < dev.length; i++) for (let j = i + 1; j < dev.length; j++) {
      expect(canonical(dev[i].text), `${dev[i].id} vs ${dev[j].id}`).not.toBe(canonical(dev[j].text));
      expect(similarity(dev[i].text, dev[j].text), `${dev[i].id} vs ${dev[j].id}`).toBeLessThan(0.8);
    }
    for (let i = 0; i < test.length; i++) for (let j = i + 1; j < test.length; j++) {
      expect(canonical(test[i].text), `${test[i].id} vs ${test[j].id}`).not.toBe(canonical(test[j].text));
      expect(similarity(test[i].text, test[j].text), `${test[i].id} vs ${test[j].id}`).toBeLessThan(0.8);
    }
  });
  it("has positive and hard-negative support in prioritized categories", () => {
    for (const items of [dev, test]) for (const category of CATEGORIES) {
      const subset = items.filter((x) => x.primaryCategory === category);
      expect(subset.some((x) => x.expect.includes(category))).toBe(true);
      expect(subset.some((x) => !x.expect.includes(category))).toBe(true);
    }
  });
  it("reports V4 development metrics", () => { console.log(metrics("V4 DEVELOPMENT", dev).join("\n")); expect(dev.length).toBe(43); });
  it("evaluates the frozen V4 test after rule decisions are frozen", () => { console.log(metrics("V4 FROZEN TEST", test).join("\n")); expect(test.length).toBe(36); });
});
