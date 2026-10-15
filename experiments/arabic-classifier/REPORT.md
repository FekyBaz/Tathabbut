# Comparison report: MARBERTv2 vs Tathabbut rules (2026-10-14, preliminary)

## 1. Which model performed best on the same test set?

The rule baseline: P/R/F1 = 1.000/1.000/1.000 (n=37 scored). MARBERTv2:
1.000/0.714/0.833. On this synthetic set the baseline wins — but that set
was built from the rules' own patterns, so the baseline number measures
self-consistency, not real-world accuracy. Neither number generalizes.

## 2. How often did it miss harmful comments?

FNR 0.286 (6/21): 3 of 4 mockery items, 1 of 4 belittling items, and both
spam items (spam is outside hate-speech scope by design). All 8 direct
insults and all 3 threats were caught.

## 3. How often did it flag respectful criticism?

Never on the scored set (FPR 0.000, 0/10). However, on ambiguous items it
flagged counterspeech that merely mentions a slur pattern (`amb-04`) and
friendly teasing (`amb-02`) as Offensive — the exact false-positive shape
that would erode trust in a reversible filter.

## 4–5. Latency, cold start, size, memory (CPU, 1 thread)

Warm: 45.9 ms/item. Cold load: ~8.5–15.5 s. Artifacts: 625 MB.
Peak RSS delta: ~929 MB. Rules baseline for comparison: 0.04 ms/item,
a few KB, no load time.

## 6. Can it run locally in the browser without an external service?

Not attempted beyond analysis, deliberately: a 625 MB / ~1 GB-RAM BERT
cannot ship inside a Manifest V3 extension without aggressive quantization
plus an ONNX/WASM pipeline, and the quality results above do not justify
that investment. BERT+WordPiece is convertible in principle
(Transformers.js supports the architecture family), but feasibility was
not demonstrated and is not claimed.

## 7. Is fine-tuning justified?

Not on current evidence. Fine-tuning on ~40 synthetic items would
overfit; a real fine-tune needs a larger consented labeled set, and the
observed errors (sarcasm, counterspeech) are the hardest cases to fix
with more of the same data.

## 8. Is an API worth considering?

Only with explicit user opt-in, a documented retention policy, and a
provider whose Arabic/mockery quality is actually measured. Nothing in
this experiment endorses any provider; no integration was built.

## 9. Next recommended experiment

If mockery coverage must improve beyond rules: collect a larger,
consented Egyptian-dialect set of sarcastic put-downs with respectful
near-matches, re-run this harness unchanged, and only then revisit
model options. Until live-feed evidence demands it, keep the rules.
