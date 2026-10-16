import { describe, expect, it } from "vitest";
import { CATEGORIES, DEFAULT_SETTINGS, classifyLocally, shouldHide, type Category } from "./policy";
import dataset from "../../eval/dataset.json";

interface DatasetItem {
  id: string;
  text: string;
  lang: string;
  expect: Category[];
  strict: boolean;
  note: string;
}

const items = (dataset as { version: string; items: DatasetItem[] }).items;
const SETTINGS = { ...DEFAULT_SETTINGS, enabledCategories: [...CATEGORIES] };

function predictedCategories(text: string): Category[] {
  const result = classifyLocally(text);
  return CATEGORIES.filter((category) =>
    shouldHide({ labels: result.labels.filter((label) => label.category === category), provider: result.provider }, SETTINGS)
  );
}

describe("labeled evaluation", () => {
  it("keeps every strict guardrail green", () => {
    const failures: string[] = [];
    for (const item of items.filter((entry) => entry.strict)) {
      const predicted = predictedCategories(item.text);
      const want = [...item.expect].sort().join(",");
      const got = [...predicted].sort().join(",");
      if (want !== got) failures.push(item.id + ": expected [" + want + "] got [" + got + "]");
    }
    expect(failures).toEqual([]);
  });

  it("reports per-category metrics (informational)", () => {
    const report: Record<string, { tp: number; fp: number; tn: number; fn: number }> = {};
    for (const category of CATEGORIES) report[category] = { tp: 0, fp: 0, tn: 0, fn: 0 };
    for (const item of items) {
      const predicted = new Set(predictedCategories(item.text));
      for (const category of CATEGORIES) {
        const actual = item.expect.includes(category);
        const flagged = predicted.has(category);
        const cell = report[category];
        if (actual && flagged) cell.tp += 1;
        else if (!actual && flagged) cell.fp += 1;
        else if (!actual && !flagged) cell.tn += 1;
        else cell.fn += 1;
      }
    }
    const lines = ["category | n-pos | TP FP TN FN | precision recall F1 FPR"];
    for (const category of CATEGORIES) {
      const cell = report[category];
      const precision = cell.tp + cell.fp === 0 ? 1 : cell.tp / (cell.tp + cell.fp);
      const recall = cell.tp + cell.fn === 0 ? 1 : cell.tp / (cell.tp + cell.fn);
      const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
      const fpr = cell.fp + cell.tn === 0 ? 0 : cell.fp / (cell.fp + cell.tn);
      lines.push(
        category + " | " + (cell.tp + cell.fn) + " | " +
        cell.tp + " " + cell.fp + " " + cell.tn + " " + cell.fn + " | " +
        precision.toFixed(3) + " " + recall.toFixed(3) + " " + f1.toFixed(3) + " " + fpr.toFixed(3)
      );
    }
    lines.push("n=" + items.length + " strict=" + items.filter((entry) => entry.strict).length);
    console.log(lines.join("\n"));
    expect(items.length).toBeGreaterThan(0);
  });
});
