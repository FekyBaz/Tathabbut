import { describe, expect, it } from "vitest";
import development from "../../eval/rule-engine-v5b-harassment-dev.json";
import frozenTest from "../../eval/rule-engine-v5b-harassment-test.json";
import v2Dev from "../../eval/rule-engine-v2-dev.json";
import v2Test from "../../eval/rule-engine-v2-test.json";
import v3Dev from "../../eval/rule-engine-v3-dev.json";
import v3Test from "../../eval/rule-engine-v3-test.json";
import v4Dev from "../../eval/rule-engine-v4-dev.json";
import v4Test from "../../eval/rule-engine-v4-test.json";
import { classifyLocally, normalizeForRules, type Category } from "./policy";

interface Example { id: string; text: string; expect: Category[]; lang: "ar" | "en" | "mixed" | "arabizi"; status: "clear" | "ambiguous"; primaryCategory: Category; rationale: string; provenance: string }
type Cell = { tp: number; fp: number; tn: number; fn: number };
const dev = development.items as Example[], test = frozenTest.items as Example[];
const previous = [v2Dev,v2Test,v3Dev,v3Test,v4Dev,v4Test].flatMap(x=>x.items as Example[]);
function canonical(s: string): string { return normalizeForRules(s).toLowerCase().replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/[\p{P}\p{S}]+/gu," ").replace(/\s+/g," ").trim(); }
function grams(s: string): Set<string> { const w=canonical(s).split(" ").filter(Boolean);return new Set(w.length<2?w:w.slice(0,-1).map((x,i)=>`${x} ${w[i+1]}`)); }
function sim(a:string,b:string):number { const x=grams(a),y=grams(b);return [...x].filter(v=>y.has(v)).length/new Set([...x,...y]).size; }
function measure(items:Example[],lang?:Example["lang"]):Cell {const c={tp:0,fp:0,tn:0,fn:0};for(const x of items.filter(e=>!lang||e.lang===lang)){const a=x.expect.includes("harassment"),p=classifyLocally(x.text).labels.some(y=>y.category==="harassment");if(a&&p)c.tp++;else if(a)c.fn++;else if(p)c.fp++;else c.tn++;}return c;}
function report(name:string,items:Example[]):string[] {const c=measure(items),f=(a:number,b:number)=>b?(a/b).toFixed(3):"n/a";const out=[`${name} n=${items.length}: TP=${c.tp} FP=${c.fp} TN=${c.tn} FN=${c.fn} P=${f(c.tp,c.tp+c.fp)} R=${f(c.tp,c.tp+c.fn)} F1=${f(2*c.tp,2*c.tp+c.fp+c.fn)}`];for(const lang of ["ar","en","mixed","arabizi"] as const){const s=items.filter(x=>x.lang===lang),m=measure(s);out.push(`${lang} n=${s.length}: TP=${m.tp} FP=${m.fp} TN=${m.tn} FN=${m.fn}`);}for(const x of items){const actual=x.expect.includes("harassment"),pred=classifyLocally(x.text).labels.some(y=>y.category==="harassment");if(actual!==pred)out.push(`error ${x.id} expected=${actual} actual=${pred}`);}return out;}
describe("V5 harassment cycle integrity and metrics",()=>{
 it("has complete, unique, policy-tagged annotations",()=>{expect(development.split).toBe("development");expect(frozenTest.split).toBe("frozen-test");expect(new Set([...dev,...test].map(x=>x.id)).size).toBe(dev.length+test.length);for(const x of [...dev,...test]){expect(x.text.length).toBeGreaterThan(0);expect(x.rationale.length).toBeGreaterThan(0);expect(x.provenance.length).toBeGreaterThan(0);expect(x.primaryCategory).toBe("harassment");expect(x.status).toBe("clear");}});
 it("screens exact and near duplicates across the V5 split",()=>{for(const a of dev)for(const b of test){expect(canonical(a.text),`${a.id} ${b.id}`).not.toBe(canonical(b.text));expect(sim(a.text,b.text),`${a.id} ${b.id}`).toBeLessThan(.8);}});
 it("screens V5 frozen test against prior V2-V4 corpora",()=>{for(const a of [...previous,...dev])for(const b of test){expect(canonical(a.text),`${a.id} ${b.id}`).not.toBe(canonical(b.text));expect(sim(a.text,b.text),`${a.id} ${b.id}`).toBeLessThan(.8);}});
 it("reports V5b development results",()=>{console.log(report("V5B DEV",dev).join("\n"));expect(dev.length).toBe(16);});
 it("scores frozen V5b only after rules are fixed",()=>{console.log(report("V5B FROZEN TEST",test).join("\n"));expect(test.length).toBe(16);});
});
