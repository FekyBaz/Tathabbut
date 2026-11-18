# V12 rule-engine cycle: Arabizi personal-abuse grammar variants

## Scope and evidence

V1–V11 frozen assets were not edited. V12 has 14 synthetic development examples (12 clear, 2 ambiguous) and 11 synthetic held-out examples (10 clear, 1 ambiguous), authored by one contributor before implementation; see [`RULE_ENGINE_V12_PLAN.md`](RULE_ENGINE_V12_PLAN.md), [`rule-engine-v12-dev.json`](rule-engine-v12-dev.json), and [`rule-engine-v12-test.json`](rule-engine-v12-test.json). No independent reviewers, adjudication, external sampling, or production comments; outcomes are exploratory single-author evidence. Unique-ID and trigram split-leakage checks passed. No post-scoring label corrections occurred.

The cycle extends one narrow gap: the reviewed insult vocabulary already covered in Arabic script and in a few Arabizi forms (`enta ghaby`, `ya ahbal`, `ya 7mar`) is missing with other personal pronouns (`inti`, `antu/entu`, `howa/heya`) and with other already-reviewed insult tokens (`7mar`, `fashel`, `ghabia`). No new insult semantics or fuzzy transliteration was introduced.

## Pre-change baseline (recorded before implementation)

Development harassment `TP=1 FP=0 TN=6 FN=5`; held-out harassment `TP=1 FP=0 TN=5 FN=4`. The single pre-change TP in each split was the mixed-script item containing the already-covered Arabic-script vocative `يا حمار`; all five/six Arabizi-specific positives failed. Zero false positives was the acceptance constraint.

Two implementation corrections were made during the dev phase, before held-out scoring: the second-person pattern initially omitted the `ghaby/ghabia` tokens (leaving `inti ghabia` uncovered), and the plan's estimated IDs were corrected after verification to `harassment.26`/`harassment.27`. No labels or texts changed.

## Prioritized findings and code traces

1. **Two appended Arabizi patterns, closed token set.** `harassment.26` covers second-person `enta/inti/antu/entu + 7mar/7mara/fashel/fashla/ghaby/ghabi/ghabia/ahbal`; `harassment.27` covers third-person `howa/heya + 7mar/7mara/fashel/fashla/ghaby/ghabia/ahbal`. Both use `(?<=^|[\s،,.!?؟])` boundary lookbehinds so matching starts at the pronoun; the second-person form adds `(?<!\b(?:mish|mesh|msh)\s+)` so Arabizi negation blocks it. No fuzzy classes (e.g. `[7h]`) or optional-vowel matching.
2. **Attribution and negation composition.** The existing `howa 2al`/`heya 2alet` reporting cue continues to suppress attributed abuse (`howa 2al enta 7mar`, `heya 2alet howa 7mar`); negation (`mish enta 7mar`, `mesh inti ghabia`) blocks the new rules. Object criticism, self-description, factual descriptions, and the literal animal noun stay visible because the pronoun + insult adjacency is required.
3. **Pre-existing negation gap deliberately not expanded this cycle.** The older `enta ghaby`/`enta faker` patterns still lack a negation guard (e.g. `mish enta ghaby`); changing them would alter existing rule behavior, so it is recorded as a gap instead of being folded into V12.

No changes to thresholds, categories, DOM, hiding, provider contract, or any existing pattern body.

## Before/after category metrics

Counts use `TP/FP/TN/FN` for category labels; ambiguous items are excluded. Harassment is the only category with V12 positive support; hate, threats, and spam have zero positives and zero false positives.

| Split | Category | n clear | Before TP/FP/TN/FN | Before P/R/F1 | After TP/FP/TN/FN | After P/R/F1 |
| --- | --- | ---: | --- | --- | --- | --- |
| V12 development | Harassment | 12 | 1/0/6/5 | 1.000/0.167/0.286 | 6/0/6/0 | 1.000/1.000/1.000 |
| V12 development | Others | 12 | 0/0/12/0 | n/a/n/a/n/a | 0/0/12/0 | n/a/n/a/n/a |
| V12 held-out | Harassment | 10 | 1/0/5/4 | 1.000/0.200/0.333 | 5/0/5/0 | 1.000/1.000/1.000 |
| V12 held-out | Others | 10 | 0/0/10/0 | n/a/n/a/n/a | 0/0/10/0 | n/a/n/a/n/a |

Per-language harassment after the change (`TP/FP/TN/FN`): development Arabizi `n=11`: `5/0/6/0`; development mixed `n=1`: `1/0/0/0`; held-out Arabizi `n=8`: `4/0/4/0`; held-out mixed `n=1`: `1/0/0/0`; held-out English control `n=1`: `0/0/1/0`. Support is small and synthetic; these are not accuracy claims.

Operational action matrix (expected rows, actual columns) on clear items:

| Split | ALLOW row: ALLOW/HIDE/REVIEW | HIDE row: ALLOW/HIDE/REVIEW | REVIEW row |
| --- | --- | --- | --- |
| V12 development, n=12 | 6/0/0 | 0/6/0 | empty |
| V12 held-out, n=10 | 5/0/0 | 0/5/0 | empty |

Frozen V7–V11 harnesses produced no action changes under the new patterns.

## Documented residual false-positive risk

Three ambiguous joke-frame items (`v12d-ar-banter`, `v12d-ar-joking`, `v12t-ar-joke`) now auto-hide (`expected=REVIEW, actual=HIDE`, excluded from metrics), the same deferred risk class as V8–V11. No exception list was added. The pre-existing negation gap in older `enta ghaby`/`enta faker` patterns and non-reviewed transliteration spellings (`enta 7omaar`) remain recorded gaps.

## Error analysis and next work

- **Fixed:** five development and four held-out Arabizi personal-abuse positives (plus one mixed-script case in each split), with zero new false positives across V1–V12 splits.
- **Still unsupported (recorded, not tuned):** negation in the older Arabizi patterns, phonetic spelling variants, new Arabizi insult tokens, threat verbs beyond the three attested forms, and joke-frame intent discrimination. The technical semantic-rule-ID cleanup remains; hate remains blocked on policy, an identity taxonomy, and independently reviewed data (P0).
- **No plateau claim:** five consecutive cycles show non-negligible held-out gains (V8–V12). The 2–3-cycle "negligible gain" exit gate is still not met; this is a rules-vocabulary ceiling argument, not a general product-readiness claim.

## Exit gate

Unchanged from V7–V11: no model comparison before independently annotated, consent-safe examples with two blinded reviewers, adjudication, a frozen split authored before tuning, per-category/per-language metrics with support, and demonstrated low false-positive harm on criticism, counterspeech, reporting, and legitimate promotion.

## Validation

The extension suite passed (24 files, 492 tests, including the V12 eval harness, 6 Arabizi positives, 9 hard negatives, rule-ID stability, and all earlier regressions); TypeScript compilation and production build passed; `verify-dist` passed within the build; backend pytest passed (33 tests); frozen V7–V11 harnesses report no action errors; and the pre-change baseline commit (`7303cbf`) plus all frozen V1–V11 assets underpin this cycle.
