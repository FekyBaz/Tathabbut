# V13 rule-engine cycle: plural and past-tense personal abuse

## Scope and evidence

V1–V12 frozen assets were not edited. V13 has 15 synthetic development examples (13 clear, 2 ambiguous) and 11 synthetic held-out examples (10 clear, 1 ambiguous), authored by one contributor before implementation; see [`RULE_ENGINE_V13_PLAN.md`](RULE_ENGINE_V13_PLAN.md), [`rule-engine-v13-dev.json`](rule-engine-v13-dev.json), and [`rule-engine-v13-test.json`](rule-engine-v13-test.json). No independent reviewers, adjudication, external sampling, or production comments; outcomes are exploratory single-author evidence. Unique-ID and trigram split-leakage checks passed. No post-scoring label corrections occurred.

The cycle closes one explicitly documented gap from the V8 cycle report and the Phase 1 gate assessment: third-person plural (`they're/they are + insult`) and past-tense (`he/she was`, `they were + insult`) abuse, using only the already-reviewed V8 insult vocabulary. Optional plural `s` is morphology, not new insult semantics.

## Pre-change baseline (recorded before implementation)

Development harassment `TP=0 FP=0 TN=7 FN=6`; held-out harassment `TP=0 FP=0 TN=5 FN=5`. All eleven positives failed; all twelve clear negatives were visible. Zero false positives was the acceptance constraint.

## Prioritized findings and code traces

1. **One appended pattern (`harassment.28`).** Copula set `they're|they are|he was|she was|they were`, existing V8 intensifiers and insult list, with optional plural `s` on count nouns (`idiots`, `morons`, `losers`, `clowns`, `assholes`, `bastards`). No new root insult tokens.
2. **Negation and attribution stay structural.** `They're not idiots`, `He wasn't stupid`, and `They weren't clowns` fail the adjacency/whitespace requirement rather than being handled by exception strings; `She said they're idiots` is suppressed by the existing reporting cue. No exception lists were added.
3. **Object/idea/activity controls hold.** `Their code is pathetic`, `Their ideas are stupid`, `They're designing the new API`, factual roles (`They're engineers`, `He was the manager`), and neutral states (`She was tired`) remain visible.

No changes to thresholds, categories, DOM, hiding, provider contract, or existing pattern bodies.

## Before/after category metrics

Counts use `TP/FP/TN/FN` for category labels; ambiguous items are excluded. Harassment is the only category with V13 positive support; hate, threats, and spam have zero positives and zero false positives.

| Split | Category | n clear | Before TP/FP/TN/FN | Before P/R/F1 | After TP/FP/TN/FN | After P/R/F1 |
| --- | --- | ---: | --- | --- | --- | --- |
| V13 development | Harassment | 13 | 0/0/7/6 | n/a/0.000/0.000 | 6/0/7/0 | 1.000/1.000/1.000 |
| V13 development | Others | 13 | 0/0/13/0 | n/a/n/a/n/a | 0/0/13/0 | n/a/n/a/n/a |
| V13 held-out | Harassment | 10 | 0/0/5/5 | n/a/0.000/0.000 | 5/0/5/0 | 1.000/1.000/1.000 |
| V13 held-out | Others | 10 | 0/0/10/0 | n/a/n/a/n/a | 0/0/10/0 | n/a/n/a/n/a |

All V13 clear items are English; development `n=13`: harassment `6/0/7/0`; held-out `n=10`: `5/0/5/0`. Other language slices are empty in V13. Support is small and synthetic; these are not accuracy claims.

Operational action matrix (expected rows, actual columns) on clear items:

| Split | ALLOW row: ALLOW/HIDE/REVIEW | HIDE row: ALLOW/HIDE/REVIEW | REVIEW row |
| --- | --- | --- | --- |
| V13 development, n=13 | 7/0/0 | 0/6/0 | empty |
| V13 held-out, n=10 | 5/0/0 | 0/5/0 | empty |

Frozen V7–V12 harnesses produced no action changes under the new pattern.

## Documented residual false-positive risk

Three ambiguous items (`v13d-en-theyre-kidding`, `v13d-en-was-clown-party`, `v13t-en-theyre-kidding`) now auto-hide (`expected=REVIEW, actual=HIDE`, excluded from metrics), continuing the V8–V12 pattern of joke/benign-frame over-hiding that requires contextual data rather than another exception rule.

## Error analysis and next work

- **Fixed:** six development and five held-out plural/past-tense personal-abuse positives with zero new false positives across V1–V13 splits.
- **Still unsupported (recorded, not tuned):** second-person past tense (`you were an idiot`), negation in the older Arabizi `enta ghaby`/`enta faker` patterns, `he's the idiot` determiner forms, omission typos beyond the reviewed alias, hate against real protected identities, and joke-frame intent discrimination. Technical semantic rule IDs and independent annotated data remain prerequisites for Phase 2.
- **No plateau claim:** six consecutive cycles show non-negligible held-out gains (V8–V13). The exit gate remains closed; see [`RULE_ENGINE_CEILING_ASSESSMENT.md`](RULE_ENGINE_CEILING_ASSESSMENT.md), which now covers V8–V13.

## Exit gate

Unchanged: no model comparison before independently annotated, consent-safe examples with two blinded reviewers, adjudication, a frozen split authored before tuning, per-category/per-language metrics with support, and demonstrated low false-positive harm on criticism, counterspeech, reporting, and legitimate promotion.

## Validation

The extension suite passed (25 files, 510 tests, including the V13 eval harness and 16 new policy regressions); TypeScript compilation and production build passed; `verify-dist` passed within the build; backend pytest passed (33 tests); frozen V7–V12 harnesses report no action errors; and the pre-change baseline commit (`7303cbf`) plus all frozen V1–V12 assets underpin this cycle.
