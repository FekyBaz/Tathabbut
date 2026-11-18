import { describe, expect, it } from "vitest";
import dev from "../../eval/rule-engine-dev.json";
import heldout from "../../eval/rule-engine-heldout.json";
import { CATEGORIES, classifyLocally, type Category } from "./policy";

interface Example {
  id: string;
  text: string;
  expect: Category[];
  lang: string;
  status: "clear" | "ambiguous";
  category: Category;
  rationale: string;
}

function scores(cell: { tp: number; fp: number; fn: number }): { precision: number | undefined; recall: number | undefined; f1: number | undefined } {
  const precision = cell.tp + cell.fp ? cell.tp / (cell.tp + cell.fp) : undefined;
  const recall = cell.tp + cell.fn ? cell.tp / (cell.tp + cell.fn) : undefined;
  const f1 = 2 * cell.tp + cell.fp + cell.fn
    ? (2 * cell.tp) / (2 * cell.tp + cell.fp + cell.fn)
    : undefined;
  return { precision, recall, f1 };
}

function show(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(3);
}

function evaluate(name: string, examples: Example[]): string[] {
  const clear = examples.filter((item) => item.status === "clear");
  const lines = [`${name}: ${clear.length} clear, ${examples.length - clear.length} ambiguous`];
  const errors: string[] = [];
  for (const item of clear) {
    const predicted = CATEGORIES.filter((category) => classifyLocally(item.text).labels.some((label) => label.category === category));
    if (predicted.length !== item.expect.length || predicted.some((category) => !item.expect.includes(category))) {
      errors.push(`${item.id} expected=[${item.expect}] got=[${predicted}] ${item.text}`);
    }
  }
  for (const category of CATEGORIES) {
    const cell = { tp: 0, fp: 0, tn: 0, fn: 0 };
    for (const item of clear) {
      const predicted = classifyLocally(item.text).labels.some((label) => label.category === category);
      const actual = item.expect.includes(category);
      if (actual && predicted) cell.tp += 1;
      else if (actual) cell.fn += 1;
      else if (predicted) cell.fp += 1;
      else cell.tn += 1;
    }
    const score = scores(cell);
    lines.push(`${category}: TP=${cell.tp} FP=${cell.fp} TN=${cell.tn} FN=${cell.fn} P=${show(score.precision)} R=${show(score.recall)} F1=${show(score.f1)}`);
  }
  for (const lang of ["ar", "en", "mixed", "arabizi"]) {
    const subset = clear.filter((item) => item.lang === lang);
    let correct = 0;
    for (const item of subset) {
      const predicted = CATEGORIES.filter((category) => classifyLocally(item.text).labels.some((label) => label.category === category));
      if (predicted.length === item.expect.length && predicted.every((label) => item.expect.includes(label))) correct += 1;
    }
    lines.push(`${lang}: exact ${correct}/${subset.length}`);
    for (const category of CATEGORIES) {
      const cell = { tp: 0, fp: 0, tn: 0, fn: 0 };
      for (const item of subset) {
        const predicted = classifyLocally(item.text).labels.some((label) => label.category === category);
        const actual = item.expect.includes(category);
        if (actual && predicted) cell.tp += 1;
        else if (actual) cell.fn += 1;
        else if (predicted) cell.fp += 1;
        else cell.tn += 1;
      }
      const score = scores(cell);
      lines.push(`  ${category}: TP=${cell.tp} FP=${cell.fp} TN=${cell.tn} FN=${cell.fn} P=${show(score.precision)} R=${show(score.recall)} F1=${show(score.f1)}`);
    }
  }
  const ambiguous = examples.filter((item) => item.status === "ambiguous");
  const ambiguousCovered = ambiguous.filter((item) => classifyLocally(item.text).labels.some((label) => label.category === item.category)).length;
  lines.push(`ambiguous covered=${ambiguousCovered}/${ambiguous.length}`);
  lines.push(...errors.map((error) => `error: ${error}`));
  return lines;
}

describe("rule engine development and held-out evaluation", () => {
  it("keeps the splits separate and every case fully labeled", () => {
    expect(dev.split).toBe("development");
    expect(heldout.split).toBe("held-out");
    const ids = new Set((dev.items as Example[]).map((item) => item.id));
    expect((heldout.items as Example[]).every((item) => !ids.has(item.id))).toBe(true);
    for (const item of [...dev.items, ...heldout.items] as Example[]) {
      expect(item.rationale.length).toBeGreaterThan(0);
      expect(["clear", "ambiguous"]).toContain(item.status);
    }
  });

  it("prints clear-case metrics without asserting a desired score", () => {
    const lines = [...evaluate("DEV", dev.items as Example[]), ...evaluate("HELD-OUT", heldout.items as Example[])];
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(0);
  });
});
