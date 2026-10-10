import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, classifyLocally, isUsableRemoteClassification, shouldHide } from "./policy";

describe("classifyLocally", () => {
  it("detects a narrow direct insult example", () => {
    expect(classifyLocally("You are an idiot").labels.map((label) => label.category)).toContain("harassment");
  });
  it("does not classify respectful criticism by default", () => {
    expect(classifyLocally("I disagree with this policy and think it should change.").labels).toEqual([]);
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
