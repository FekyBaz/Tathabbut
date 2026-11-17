import { describe, expect, it } from "vitest";
import { classifyLocally, decidePolicy, DEFAULT_SETTINGS } from "./policy";

function localOutput(text: string, threshold = DEFAULT_SETTINGS.threshold) {
  const classification = classifyLocally(text);
  const decision = decidePolicy(classification, { ...DEFAULT_SETTINGS, threshold });
  return {
    labels: classification.labels,
    matches: classification.matches,
    action: decision.action,
    reason: decision.reason,
    categories: decision.categories,
    ruleIds: decision.ruleIds
  };
}

describe("V7 local decision baseline before remote-path removal", () => {
  it("preserves ALLOW, explicit HIDE, and contextual REVIEW evidence", () => {
    expect(localOutput("The argument is weak, but the code is useful.")).toEqual({
      labels: [], matches: [], action: "ALLOW", reason: "no-rule-match", categories: [], ruleIds: []
    });
    expect(localOutput("You are an idiot")).toEqual({
      labels: [{ category: "harassment", score: 0.86 }],
      matches: [{ category: "harassment", ruleId: "harassment.1", specificity: "high", reason: "Targeted personal abuse phrase matched." }],
      action: "HIDE", reason: "rule-match", categories: ["harassment"], ruleIds: ["harassment.1"]
    });
    expect(localOutput("يا سلام على الفهم")).toEqual({
      labels: [{ category: "harassment", score: 0.86 }],
      matches: [{ category: "harassment", ruleId: "harassment.14", specificity: "contextual", reason: "Mockery phrase is context-dependent and has no explicit target." }],
      action: "REVIEW", reason: "contextual-rule-match", categories: ["harassment"], ruleIds: ["harassment.14"]
    });
  });

  it("preserves inclusive threshold boundaries", () => {
    expect(localOutput("You are an idiot", 0.85).action).toBe("HIDE");
    expect(localOutput("You are an idiot", 0.86).action).toBe("HIDE");
    expect(localOutput("You are an idiot", 0.87)).toMatchObject({
      action: "REVIEW", reason: "below-threshold", categories: ["harassment"], ruleIds: ["harassment.1"]
    });
  });

  it("preserves multi-category high-specificity evidence", () => {
    expect(localOutput("You are an idiot, and I'll break your jaw.")).toMatchObject({
      labels: [{ category: "harassment", score: 0.86 }, { category: "threats", score: 0.9 }],
      action: "HIDE", categories: ["harassment", "threats"], ruleIds: ["harassment.1", "threats.2"]
    });
  });

  it("preserves sentence-scoped reporting and later authored content", () => {
    expect(localOutput("She said you are an idiot. I replied that you're pathetic.")).toMatchObject({
      labels: [{ category: "harassment", score: 0.86 }], action: "HIDE", categories: ["harassment"]
    });
    expect(localOutput("The witness said, 'I'll break your jaw.' I will hurt you if you return.")).toMatchObject({
      labels: [{ category: "threats", score: 0.9 }], action: "HIDE", categories: ["threats"]
    });
  });
});
