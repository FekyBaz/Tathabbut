# V7 rule-engine cycle: sentence-scoped attribution and conservative review

## Scope and evidence

V2-V6 frozen assets were not edited. V7 has 10 synthetic development examples (7 clear, 3 ambiguous) and 10 synthetic held-out examples (8 clear, 2 ambiguous), authored by one contributor before implementation. There were no independent reviewers, adjudication, external sampling, or production comments. After first scoring, the author audit corrected three contradictory labels (two isolated mockery signals and one literal `group` placeholder) to ambiguous because their rationales did not establish those categories. Text and split membership remain unchanged, but one correction is in V7 test, so V7 is no longer an untouched labeled test; outcomes are exploratory only. V7 integrity checks require unique IDs and no cross-split normalized token-trigram Jaccard similarity at or above 0.8; this cannot detect paraphrase or shared-author leakage. See [`RULE_ENGINE_V7_METHODOLOGY.md`](RULE_ENGINE_V7_METHODOLOGY.md) for policy, rationale fields, and independent-review protocol.

The baseline used the pre-change committed policy. The later label audit is disclosed above; no rule was selected or broadened to repair the remaining held-out miss. Because test labels were corrected after first scoring, this comparison is not independent validation.

## Prioritized findings and code traces

1. **Reported phrase erased later text.** `classificationText` previously returned `text.slice(0, cue.index)` at the first `REPORTING_CUE`; a report near the beginning discarded later sentences. This caused reported-then-authored harassment misses. The threat joke/report guard similarly truncated the entire tail. The scoped fix removes only the sentence governed by the cue and retains other sentences; preceding direct abuse remains available for matching.
2. **First-person authored speech truncated at an embedded cue.** The `told/called ... me/him/her/...` alternative could match inside `I told him, you're pathetic` and delete the authored insult. The cue handler now preserves a clause whose lead identifies first-person authorship (`I`/`we` equivalents included narrowly for Arabic). A regression test covers the English case; no broad reporting grammar was added.
3. **Context-only rules auto-hid.** Pattern-order IDs now identify ambiguous mockery (`harassment.14` without an explicit Arabic addressee), the literal hate placeholder (`hate.1`), and generic promotion/prize phrases (`spam.1`, `spam.3`) as contextual evidence. They produce `REVIEW`, which stays visible, rather than auto-hide. The prize phrase can reach high specificity when prize/reward and private solicitation co-occur. High-specificity matches retain the existing score/threshold contract.
4. **Threshold name overstated certainty.** The displayed “Confidence threshold” label became “Rule-strength threshold” (`عتبة قوة القاعدة`); local scores remain fixed routing values, not calibrated probabilities.

No broad keyword, transliteration, or normalization rules were added. DOM extraction, hiding, and reveal lifecycle code was not changed. `REVIEW` is an operational decision exposed in local diagnostic decision records; it does not create a separate user-facing queue or hide content.

## Before/after category metrics

Counts use `TP/FP/TN/FN` for category labels. Ambiguous items are excluded. Values are descriptive; small support makes perfect scores uninformative.

| Split | Category | n clear | Before TP/FP/TN/FN | Before P/R/F1 | After TP/FP/TN/FN | After P/R/F1 |
| --- | --- | ---: | --- | --- | --- | --- |
| V7 development | Harassment | 7 | 0/0/5/2 | n/a/0.000/0.000 | 2/0/5/0 | 1.000/1.000/1.000 |
| V7 development | Hate | 7 | 0/0/7/0 | n/a/n/a/n/a | 0/0/7/0 | n/a/n/a/n/a |
| V7 development | Threats | 7 | 1/0/6/0 | 1.000/1.000/1.000 | 1/0/6/0 | 1.000/1.000/1.000 |
| V7 development | Spam | 7 | 0/0/7/0 | n/a/n/a/n/a | 0/0/7/0 | n/a/n/a/n/a |
| V7 held-out | Harassment | 8 | 2/0/4/2 | 1.000/0.500/0.667 | 3/0/4/1 | 1.000/0.750/0.857 |
| V7 held-out | Hate | 8 | 0/0/8/0 | n/a/n/a/n/a | 0/0/8/0 | n/a/n/a/n/a |
| V7 held-out | Threats | 8 | 1/0/7/0 | 1.000/1.000/1.000 | 1/0/7/0 | 1.000/1.000/1.000 |
| V7 held-out | Spam | 8 | 1/0/7/0 | 1.000/1.000/1.000 | 1/0/7/0 | 1.000/1.000/1.000 |

After-change per-language counts are `TP/FP/TN/FN`; unsupported slices are `n=0`. Development Arabic `n=2`: harassment `1/0/1/0`, other categories `0/0/2/0`; development English `n=5`: harassment `1/0/4/0`, hate `0/0/5/0`, threats `1/0/4/0`, spam `0/0/5/0`. Held-out Arabic `n=3`: harassment `1/0/2/0`, hate `0/0/3/0`, threats `0/0/3/0`, spam `1/0/2/0`. Held-out English `n=5`: harassment `2/0/2/1`, hate `0/0/5/0`, threats `1/0/4/0`, spam `0/0/5/0`. Mixed and Arabizi support are zero in V7. Hate has zero clear positive support in either split; there are no hate precision/recall claims. Other categories have only one clear positive per supporting split. These tiny synthetic slices do not evidence general coverage.

Operational action matrix (expected rows, actual columns) on clear items:

| Split | ALLOW row: ALLOW/HIDE/REVIEW | HIDE row: ALLOW/HIDE/REVIEW | REVIEW row: ALLOW/HIDE/REVIEW |
| --- | --- | --- | --- |
| Development, n=7 | 4/0/0 | 0/3/0 | 0/0/0 |
| Held-out, n=8 | 2/0/0 | 1/4/0 | 0/0/1 |

The held-out operational miss is `v7t-en-report-then-attack`: after the reported sentence is removed, the remaining `he's pathetic` construction is not covered by the current second-person insult patterns. This is an explicit third-person targeting grammar gap. A single case does not justify broadening to all third-person negative descriptions; development needs independently reviewed positive and object/idea hard-negative pairs first.

## Error analysis and next work

- **Fixed on these challenge items:** later attacks after a reported sentence, with no new V7 false positives. On policy-corrected labels, development harassment moved from 0/0/5/2 to 2/0/5/0 and V7 test from 2/0/4/2 to 3/0/4/1 (TP/FP/TN/FN). This gains two development TPs and one test TP, but V7 labels are single-author and post-hoc corrected; it is exploratory evidence only.
- **Still unsupported:** third-person authored personal abuse (`he's pathetic`), same-sentence mixed attribution/endorsement, insults with target omitted, hate against actual protected identities, wider Arabizi and dialect coverage, and spam intent in legitimate promotion contexts.
- **Review policy:** ambiguous mockery, placeholder identity wording, generic prize phrase, and high user thresholds remain visible. This is conservative classification behavior; no independent human review workflow is provided.
- **No plateau claim:** only one small V7 cycle is available; V2-V6 were not comparable independent cycles for this root cause, and no real-world sample exists. Further deterministic work is justified for sentence-scoped attribution variants and tested high-specificity patterns, but hate generalization, third-person harassment expansion, transliteration, fuzzy matching, and semantic intent need reviewed contrastive data first.

## Exit gate

Do not begin any model comparison based on V7 scores. First obtain independently annotated, consent-safe examples across Arabic dialects, English, mixed text, and Arabizi; have two blinded reviewers label each example and adjudicate disagreements; freeze a separate test split before tuning; report category/language action and label metrics with support and uncertainty; and demonstrate stable high precision without disproportionate false positives on criticism, counterspeech, reporting, and legitimate promotion. V7 supports a narrow deterministic attribution fix and conservative review behavior, not a general readiness or ceiling conclusion.

## Validation

The extension suite passed (20 files, 406 tests); TypeScript compilation and production build passed; `verify-dist` passed both within the build and independently; backend pytest passed (33 tests); browser fixture lab passed 105/105 scenarios; and `git diff --check` passed. The fixture lab is synthetic and does not verify the live Facebook DOM.
