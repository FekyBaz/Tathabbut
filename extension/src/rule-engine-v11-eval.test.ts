import { describe, expect, it } from "vitest";
import dev from "../../eval/rule-engine-v11-dev.json";
import test from "../../eval/rule-engine-v11-test.json";
import { CATEGORIES, DEFAULT_SETTINGS, classifyLocally, decidePolicy, type Category } from "./policy";

interface Item {
  id: string; text: string; lang: "ar" | "en" | "mixed" | "arabizi";
  expect: Category[]; expectedAction: "ALLOW" | "HIDE" | "REVIEW";
  status: "clear" | "ambiguous"; rationale: string;
}
const devItems = dev.items as Item[];
const testItems = test.items as Item[];
const action = (x: Item) => decidePolicy(classifyLocally(x.text), DEFAULT_SETTINGS).action;
const canonical = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function nearDuplicate(a: string, b: string): boolean {
  const grams = (s: string) => { const t=canonical(s).split(" ").filter(Boolean); return new Set(Array.from({length:Math.max(0,t.length-2)},(_,i)=>t.slice(i,i+3).join(" "))); };
  const aa=grams(a),bb=grams(b); if (!aa.size || !bb.size) return canonical(a)===canonical(b);
  let intersection=0; for(const g of aa) if(bb.has(g)) intersection++;
  return intersection/(aa.size+bb.size-intersection)>=0.8;
}
function counts(rows: Item[], cat: Category) {
  const c={tp:0,fp:0,tn:0,fn:0};
  for(const x of rows.filter(y=>y.status==="clear")) {
    const expected=x.expect.includes(cat), predicted=classifyLocally(x.text).labels.some(y=>y.category===cat);
    if(expected&&predicted)c.tp++; else if(expected)c.fn++; else if(predicted)c.fp++; else c.tn++;
  }
  return c;
}
const ratio=(n:number,d:number)=>d?(n/d).toFixed(3):"n/a";
function printReport(name:string,rows:Item[]) {
  const out=[`${name}: n=${rows.length}, clear=${rows.filter(x=>x.status==="clear").length}, ambiguous=${rows.filter(x=>x.status==="ambiguous").length}`];
  for(const cat of CATEGORIES){const c=counts(rows,cat);out.push(`${cat}: TP=${c.tp} FP=${c.fp} TN=${c.tn} FN=${c.fn} P=${ratio(c.tp,c.tp+c.fp)} R=${ratio(c.tp,c.tp+c.fn)} F1=${ratio(2*c.tp,2*c.tp+c.fp+c.fn)}`);}
  for(const lang of ["ar","en","mixed","arabizi"] as const){const slice=rows.filter(x=>x.lang===lang&&x.status==="clear");out.push(`${lang} n=${slice.length}: `+CATEGORIES.map(cat=>{const c=counts(slice,cat);return `${cat} ${c.tp}/${c.fp}/${c.tn}/${c.fn}`;}).join("; "));}
  const actions=["ALLOW","HIDE","REVIEW"] as const;
  out.push("action matrix rows=expected, columns=actual");
  out.push("          "+actions.join(" "));
  for(const expected of actions){const cells=actions.map(actual=>rows.filter(x=>x.status==="clear"&&x.expectedAction===expected&&action(x)===actual).length);out.push(`${expected.padEnd(9)} ${cells.join(" ")}`);}
  for(const x of rows.filter(x=>x.status==="clear")){const predicted=action(x);if(predicted!==x.expectedAction)out.push(`action-error ${x.id}: expected=${x.expectedAction} actual=${predicted}`);}
  for(const x of rows.filter(x=>x.status==="ambiguous"))out.push(`ambiguous ${x.id}: expected=${x.expectedAction} actual=${action(x)} (excluded from metrics)`);
  return out.join("\n");
}

describe("V11 local rule evaluation",()=>{
  it("has distinct, rationale-tagged items and no exact or near-duplicate split leakage",()=>{
    expect(dev.split).toBe("development"); expect(test.split).toBe("held-out");
    expect(new Set(devItems.map(x=>x.id)).size).toBe(devItems.length);
    expect(new Set(testItems.map(x=>x.id)).size).toBe(testItems.length);
    for(const x of [...devItems,...testItems]){expect(x.rationale.length).toBeGreaterThan(0);expect(canonical(x.text).length).toBeGreaterThan(0);}
    for(const a of devItems) for(const b of testItems) expect(nearDuplicate(a.text,b.text),`${a.id} / ${b.id}`).toBe(false);
  });
  it("reports metrics separately and does not treat ambiguous labels as ground truth",()=>{
    console.log(printReport("V11 development (synthetic)",devItems));
    console.log(printReport("V11 frozen test (synthetic)",testItems));
    for(const x of devItems.filter(y=>y.status==="clear")) expect(action(x),x.id).toBe(x.expectedAction);
    expect(devItems.length).toBe(15); expect(testItems.length).toBe(11);
    expect(devItems.filter(x=>x.status==="ambiguous")).toHaveLength(2);
    expect(testItems.filter(x=>x.status==="ambiguous")).toHaveLength(2);
  });
});
