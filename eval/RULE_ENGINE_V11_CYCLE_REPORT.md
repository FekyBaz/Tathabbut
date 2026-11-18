# V11 rule-engine cycle: bounded repeated-letter normalization and one reviewed alias

## Scope and evidence

V1–V10 frozen assets were not edited. V11 has 15 synthetic development examples (13 clear, 2 ambiguous) and 11 synthetic held-out examples (9 clear, 2 ambiguous), authored by one contributor before implementation; see [`RULE_ENGINE_V11_PLAN.md`](RULE_ENGINE_V11_PLAN.md), [`rule-engine-v11-dev.json`](rule-engine-v11-dev.json), and [`rule-engine-v11-test.json`](rule-engine-v11-test.json). No independent reviewers, adjudication, external sampling, or production comments; outcomes are exploratory single-author evidence. The documented v1 dev miss `idiooot` and v1 held-out miss `idot` are cited as evidence only; all V11 texts are newly authored. Unique-ID and trigram split-leakage checks passed. No post-scoring label corrections occurred.

V11 is deliberately bounded to two mechanisms: collapse runs of 3+ identical letters to one (script-neutral), and one reviewed alias `idot` under the existing grammatical target requirement. General edit distance, phonetic/fuzzy matching, and other omission typos are out of scope.

## Pre-change baseline (recorded before implementation)

Development harassment `TP=0 FP=0 TN=7 FN=6`; held-out harassment `TP=0 FP=0 TN=5 FN=4`. All ten positives failed; all twelve clear negatives were already visible. Zero false positives was the acceptance constraint for a global normalization change.

## Prioritized findings and code traces

1. **Global bounded collapse.** `normalizeForRules` now applies `/(\p{L})\1{2,}/giu → "$1"` after the existing Alef/ya normalization and before whitespace collapse. Stretched English and Arabic insult spellings recover the reviewed vocabulary; ordinary doubled letters (`all`, `see`, `too`, `coffee`, `success`) and emphatic stretches with no insult (`soooo`, `Yessss`, `ههههه`) remain non-matching.
2. **Unicode class bug found during dev scoring.** The first implementation used a `\w`-based letter class: JavaScript `\w` is ASCII-only even with the `u` flag, so all three Arabic positives failed while English ones passed. The corrected class `\p{L}` covers Arabic. This was a rule-text fix within the dev phase, before held-out scoring; both spellings are locked by regression tests.
3. **One reviewed alias, appended (`harassment.25`).** `you're/you are/he's/he is/she's/she is + (a/an)? idot` covers the attested omission form for both second and third person without generalizing to `idol`, to untargeted uses ("The idot report"), or to other misspellings.
4. **Blast-radius check.** Because the collapse runs before all category rules, the frozen V7, V8, V9, and V10 harnesses were re-run: no action changes, no new false positives, and the 59-item classification corpus stayed green. The unsupported omission form `chokke` is labeled ambiguous in held-out and correctly abstains (ALLOW), documenting the boundary instead of patching it.

No changes to thresholds, categories, DOM, hiding, provider contract, or any existing pattern body.

## Before/after category metrics

Counts use `TP/FP/TN/FN` for category labels; ambiguous items are excluded. Values are descriptive; small support makes perfect scores uninformative. Harassment is the only category with V11 positive support; hate, threats, and spam have zero positives and zero false positives.

| Split | Category | n clear | Before TP/FP/TN/FN | Before P/R/F1 | After TP/FP/TN/FN | After P/R/F1 |
| --- | --- | ---: | --- | --- | --- | --- |
| V11 development | Harassment | 13 | 0/0/7/6 | n/a/0.000/0.000 | 6/0/7/0 | 1.000/1.000/1.000 |
| V11 development | Others | 13 | 0/0/13/0 | n/a/n/a/n/a | 0/0/13/0 | n/a/n/a/n/a |
| V11 held-out | Harassment | 9 | 0/0/5/4 | n/a/0.000/0.000 | 4/0/5/0 | 1.000/1.000/1.000 |
| V11 held-out | Others | 9 | 0/0/9/0 | n/a/n/a/n/a | 0/0/9/0 | n/a/n/a/n/a |

Per-language harassment after the change (`TP/FP/TN/FN`): development English `n=10`: `4/0/6/0`; development Arabic `n=3`: `2/0/1/0`; held-out English `n=7`: `3/0/4/0`; held-out Arabic `n=2`: `1/0/1/0`. Mixed and Arabizi support is zero in V11.

Operational action matrix (expected rows, actual columns) on clear items:

| Split | ALLOW row: ALLOW/HIDE/REVIEW | HIDE row: ALLOW/HIDE/REVIEW | REVIEW row |
| --- | --- | --- | --- |
| V11 development, n=13 | 7/0/0 | 0/6/0 | empty |
| V11 held-out, n=9 | 5/0/0 | 0/4/0 | empty |

## Documented residual false-positive risk

Three ambiguous joke-frame items — `v11d-en-dummmb-joke`, `v11d-ar-ahbal-joke`, `v11t-en-ambiguous-joke` — now auto-hide after normalization (`expected=REVIEW, actual=HIDE`, excluded from metrics), the same deferred risk class as V8's `clown` frame, V9's banter threats, and V10's committee raffles. No exception list was added. The held-out `v11t-en-omission-verb-gap` (`chokke`) is a genuine uncovered omission typo and is labeled ambiguous with expected ALLOW; the engine correctly abstains.

## Error analysis and next work

- **Fixed:** four English and two Arabic stretched insults in development, three English and one Arabic in held-out, plus the two reviewed `idot` forms — all with zero new false positives across V1–V11 splits.
- **Still unsupported (recorded, not tuned):** other omission/substitution typos (`chokke`), fuzzy transliteration, unknown stretched insult tokens beyond the reviewed vocabulary, and intent discrimination in joke frames. Remaining roadmap items: V12 Arabizi variation and semantic rule IDs (technical). Hate remains blocked on policy, an identity taxonomy, and independently reviewed data (P0).
- **No plateau claim:** four consecutive cycles show non-negligible held-out gains (V8–V11). The 2–3-cycle "negligible gain" exit gate is not met.

## Exit gate

Unchanged from V7–V10: no model comparison before independently annotated, consent-safe examples with two blinded reviewers, adjudication, a frozen split authored before tuning, per-category/per-language metrics with support, and demonstrated low false-positive harm on criticism, counterspeech, reporting, and legitimate promotion.

## Validation

The extension suite passed (23 files, 474 tests, including the V11 eval harness, 6 stretched/alias positives, 8 benign-stretch and untargeted negatives, normalization-boundary checks, and rule-ID stability); TypeScript compilation and production build passed; `verify-dist` passed within the build; backend pytest passed (33 tests); frozen V7–V10 harnesses report no action errors; and the pre-change baseline commit (`7303cbf`) plus all frozen V1–V10 assets underpin this cycle.
