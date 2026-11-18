import { describe, expect, it } from "vitest";
import v7dev from "../../eval/rule-engine-v7-dev.json";
import v7test from "../../eval/rule-engine-v7-test.json";
import v8dev from "../../eval/rule-engine-v8-dev.json";
import v8test from "../../eval/rule-engine-v8-test.json";
import v9dev from "../../eval/rule-engine-v9-dev.json";
import v9test from "../../eval/rule-engine-v9-test.json";
import v10dev from "../../eval/rule-engine-v10-dev.json";
import v10test from "../../eval/rule-engine-v10-test.json";
import v11dev from "../../eval/rule-engine-v11-dev.json";
import v11test from "../../eval/rule-engine-v11-test.json";
import v12dev from "../../eval/rule-engine-v12-dev.json";
import v12test from "../../eval/rule-engine-v12-test.json";
import v13dev from "../../eval/rule-engine-v13-dev.json";
import v13test from "../../eval/rule-engine-v13-test.json";
import v14dev from "../../eval/rule-engine-v14-dev.json";
import v14test from "../../eval/rule-engine-v14-test.json";
import { DEFAULT_SETTINGS, classifyLocally, decidePolicy } from "./policy";

// V7-V14 datasets predate the discourseType field of the independent
// annotation package. This mapping is explicit and approximate; it is used
// ONLY for an exploratory baseline over existing single-author synthetic
// items, never as independent ground truth. Text is unchanged.
const DISCOURSE: Record<string, string> = {
  // authored attacks
  "direct-personal-abuse": "attack",
  "direct-third-person-abuse": "attack",
  "conjoined-third-person-abuse": "attack",
  "authored-insult-in-first-person-report": "attack",
  "reported-then-direct": "attack",
  "reported-then-third-person-attack": "attack",
  "direct-then-reported": "attack",
  "arabizi-feminine-insult": "attack",
  "arabizi-plural-insult": "attack",
  "arabizi-second-person-insult": "attack",
  "arabizi-third-person-insult": "attack",
  "unnegated-arabizi-insult": "attack",
  "stretched-insult": "attack",
  "stretched-third-person-insult": "attack",
  "stretched-arabic-insult": "attack",
  "attested-omission-typo": "attack",
  "future-intent-personal-injury": "attack",
  "future-intent-body-injury": "attack",
  "egyptian-future-injury": "attack",
  "mixed-script-threat": "attack",
  "prize-and-private-contact": "attack",
  "third-person-plural-abuse": "attack",
  "past-tense-personal-abuse": "attack",
  "past-tense-plural-abuse": "attack",
  // reporting / quotation
  "reported-only": "reporting/quotation",
  "reported-insult": "reporting/quotation",
  "reported-threat": "reporting/quotation",
  "reported-hypothetical": "reporting/quotation",
  "attributed-third-person-opinion": "reporting/quotation",
  // satire, banter, sarcasm, ambiguity of intent
  "ambiguous-banter": "satire/banter",
  "ambiguous-joking": "satire/banter",
  "ambiguous-typo-banter": "satire/banter",
  "ambiguous-mockery": "satire/banter",
  "ambiguous-teasing-frame": "satire/banter",
  "ambiguous-praise-or-sarcasm": "satire/banter",
  "ambiguous-benign-frame": "satire/banter",
  "ambiguous-skill-vs-person": "satire/banter",
  // criticism of work, ideas, plans, and benign descriptions
  "criticism-of-idea": "criticism",
  "criticism-of-work": "criticism",
  "criticism-of-plan": "criticism",
  "criticism-of-skill": "criticism",
  "mixed-person-praise-and-object-criticism": "criticism",
  "legitimate-prize": "criticism",
  "benign-emphatic-stretch": "criticism",
  "benign-arabic-stretch": "criticism",
  "benign-laughter-stretch": "criticism",
  "benign-idiom": "criticism",
  "benign-control": "criticism",
  "factual-description": "criticism",
  "factual-third-person-description": "criticism",
  "state-description": "criticism",
  "literal-animal": "criticism",
  "near-miss-token": "criticism",
  "english-negation-control": "criticism",
  "self-description": "criticism",
  "self-directed-reflexive": "criticism",
  "activity-description": "criticism",
  "benign-private-contact": "criticism",
  "ordinary-logistics": "criticism",
  "past-prize-report": "criticism",
  "generic-promotion": "criticism",
  "unsupported-omission-typo": "criticism",
  // explicitly legitimate but scam-shaped contexts
  "ambiguous-congratulation": "legitimate-context",
  "ambiguous-legitimate-raffle": "legitimate-context",
  "ambiguous-typo-banter-joke": "legitimate-context"
};

interface Item {
  id: string; text: string; expect: string[]; expectedAction: "ALLOW" | "HIDE" | "REVIEW";
  status: "clear" | "ambiguous"; contextType: string;
}
const SETS: Array<[string, { items: Item[] }]> = [
  ["v7", v7dev as { items: Item[] }], ["v7", v7test as { items: Item[] }],
  ["v8", v8dev as { items: Item[] }], ["v8", v8test as { items: Item[] }],
  ["v9", v9dev as { items: Item[] }], ["v9", v9test as { items: Item[] }],
  ["v10", v10dev as { items: Item[] }], ["v10", v10test as { items: Item[] }],
  ["v11", v11dev as { items: Item[] }], ["v11", v11test as { items: Item[] }],
  ["v12", v12dev as { items: Item[] }], ["v12", v12test as { items: Item[] }],
  ["v13", v13dev as { items: Item[] }], ["v13", v13test as { items: Item[] }],
  ["v14", v14dev as { items: Item[] }], ["v14", v14test as { items: Item[] }]
];

const TYPES = ["attack", "reporting/quotation", "satire/banter", "criticism", "legitimate-context", "other"] as const;

describe("Exploratory false-positive-harm baseline over V7-V14", () => {
  it("reports hidden-when-visible by discourse type and guards clear-item false positives", () => {
    const rows = new Map<string, { n: number; clear: number; amb: number; overHidden: number; clearFP: number; ids: string[] }>();
    for (const type of TYPES) rows.set(type, { n: 0, clear: 0, amb: 0, overHidden: 0, clearFP: 0, ids: [] });
    for (const [version, set] of SETS) {
      for (const item of set.items) {
        const type = DISCOURSE[item.contextType] ?? "other";
        const row = rows.get(type)!;
        const actual = decidePolicy(classifyLocally(item.text), DEFAULT_SETTINGS).action;
        row.n += 1;
        if (item.status === "clear") row.clear += 1;
        else row.amb += 1;
        // "Silenced" = the rule engine hides text that the annotation says
        // must stay visible (ALLOW) or only merits contextual REVIEW.
        if (actual === "HIDE" && item.expectedAction !== "HIDE") {
          row.overHidden += 1;
          row.ids.push(`${version}:${item.id}`);
        }
        if (item.status === "clear" && item.expect.length === 0 && actual === "HIDE") {
          row.clearFP += 1;
        }
      }
    }
    const lines = ["discourseType n clear ambiguous hiddenWhenVisible clearFP rate"];
    for (const type of TYPES) {
      const r = rows.get(type)!;
      lines.push(`${type.padEnd(20)} ${String(r.n).padStart(3)} ${String(r.clear).padStart(5)} ${String(r.amb).padStart(10)} ${String(r.overHidden).padStart(17)} ${String(r.clearFP).padStart(7)} ${r.n ? (r.overHidden / r.n).toFixed(3) : "n/a"}`);
      if (r.overHidden) lines.push(`  over-hidden ids: ${r.ids.join(", ")}`);
    }
    console.log(lines.join("\n"));
    // Clear, policy-labelled negatives must never be auto-hidden by rules.
    for (const type of TYPES) expect(rows.get(type)!.clearFP, type).toBe(0);
  });
});
