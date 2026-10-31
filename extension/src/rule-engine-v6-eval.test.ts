import { describe, expect, it } from "vitest";
import data from "../../eval/rule-engine-v6-ar-dev.json";
import { CATEGORIES, classifyLocally, type Category } from "./policy";

interface Example { id: string; text: string; expect: Category[]; lang: "ar" | "en" | "mixed" | "arabizi"; status: "clear" | "ambiguous"; primaryCategory: Category; rationale: string; provenance: string }
type Counts={tp:number;fp:number;tn:number;fn:number};
const items=data.items as Example[];
function count(rows:Example[],category:Category):Counts{const c={tp:0,fp:0,tn:0,fn:0};for(const x of rows.filter(x=>x.status==="clear")){const actual=x.expect.includes(category),pred=classifyLocally(x.text).labels.some(y=>y.category===category);if(actual&&pred)c.tp++;else if(actual)c.fn++;else if(pred)c.fp++;else c.tn++;}return c;}
function metric(n:number,d:number):string{return d?(n/d).toFixed(3):"n/a";}
function report():string[]{const out=[`V6 development: ${items.filter(x=>x.status==="clear").length} clear, ${items.filter(x=>x.status==="ambiguous").length} ambiguous`];for(const cat of CATEGORIES){const c=count(items,cat);out.push(`${cat}: pos=${c.tp+c.fn} neg=${c.tn+c.fp} TP=${c.tp} FP=${c.fp} TN=${c.tn} FN=${c.fn} P=${metric(c.tp,c.tp+c.fp)} R=${metric(c.tp,c.tp+c.fn)} F1=${metric(2*c.tp,2*c.tp+c.fp+c.fn)}`);}for(const lang of ["ar","en","mixed","arabizi"] as const){const rows=items.filter(x=>x.lang===lang&&x.status==="clear");out.push(`${lang} n=${rows.length}`);for(const cat of CATEGORIES){const c=count(rows,cat);out.push(`  ${cat}: TP=${c.tp} FP=${c.fp} TN=${c.tn} FN=${c.fn}`);}}for(const x of items.filter(x=>x.status==="clear")){const got=classifyLocally(x.text).labels.map(y=>y.category);if(got.length!==x.expect.length||got.some(y=>!x.expect.includes(y)))out.push(`error ${x.id} expected=[${x.expect}] actual=[${got}]`);}return out;}

describe("V6 Egyptian Arabic abuse development evaluation",()=>{
  it("contains complete, unique, rationale-tagged observations",()=>{expect(data.split).toBe("development");expect(new Set(items.map(x=>x.id)).size).toBe(items.length);for(const x of items){expect(x.text.length).toBeGreaterThan(0);expect(x.rationale.length).toBeGreaterThan(0);expect(x.provenance.length).toBeGreaterThan(0);expect(CATEGORIES).toContain(x.primaryCategory);expect(["clear","ambiguous"]).toContain(x.status);}});
  it("reports before/after development metrics without turning ambiguous items into labels",()=>{console.log(report().join("\n"));expect(items.length).toBe(26);expect(items.filter(x=>x.status==="ambiguous").length).toBe(2);});
});
