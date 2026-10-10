import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, classifyLocally, isUsableRemoteClassification, shouldHide } from "./policy";

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
