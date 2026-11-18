# V8 rule-engine cycle: third-person authored abuse

## Scope and evidence

V1-V7 frozen assets were not edited. V8 has 15 synthetic development examples (13 clear, 2 ambiguous) and 12 synthetic held-out examples (11 clear, 1 ambiguous), authored by one contributor before implementation; see [`RULE_ENGINE_V8_PLAN.md`](RULE_ENGINE_V8_PLAN.md), [`rule-engine-v8-dev.json`](rule-engine-v8-dev.json), and [`rule-engine-v8-test.json`](rule-engine-v8-test.json). There were no independent reviewers, adjudication, external sampling, or production comments, so all V8 outcomes are exploratory single-author evidence. Integrity checks require unique IDs and no cross-split normalized token-trigram Jaccard similarity at or above 0.8; this cannot detect paraphrase or shared-author leakage. No label corrections occurred after first scoring.

The cycle targets one documented gap only: third-person **authored** personal abuse (`he's/she's pathetic`, `هو/هي غبي`), which the V7 cycle report recorded as the held-out miss `v7t-en-report-then-attack`.

## Prioritized findings and code traces

1. **Third-person patterns appended, not inserted.** Two harassment patterns were appended at the end of the array so every existing position-derived rule ID stays stable (verified: legacy items still report their old IDs; the new rules are `harassment.23` English and `harassment.24` Arabic). Both mirror the existing second-person insult vocabulary and intensifiers exactly — no new insult tokens were introduced — and both are high specificity because the pronoun supplies an explicit grammatical target, so they may auto-hide at the existing threshold (0.86 ≥ 0.85). The Arabic form requires pronoun-insult adjacency and accepts the waw-conjoined pronoun (`وهو اهبل`), reusing the existing alef/ya normalization.
2. **Quote stripping ate the sentence boundary (root cause of the V7 miss).** `classificationText` removed quoted segments wholesale; a quote ending with terminal punctuation consumed its own period, merging the reported sentence with the following authored sentence (`He told me, 'You are a moron.' Then I told him he's pathetic.` became one sentence), and the first reporting cue then suppressed everything, including the authored insult. The fix preserves a sentence boundary (`" ."`) when a quoted segment ends with terminal punctuation before its closing quote. The scoped principle is unchanged from V7: attribution governs only the sentence it appears in. Note the third-person pattern alone did NOT fix the miss — without the boundary fix the merged sentence never reached it.
3. **Narrow cognition-attribution guard.** `REPORTING_CUE` gained one alternative: third-person cognition verbs (`he|she|they + thinks/believes/claims`), so `She thinks he's an idiot` stays visible as attributed opinion. First-person cognition remains authored: `I think you're an idiot` still hides, and `I believe he is a good teammate` stays allowed (both covered by regression tests). No second-person behavior changed: `Everyone believes you're a fraud` still matches the second-person pattern because the guard is pronoun-restricted.

No DOM extraction, hiding, reveal, or lifecycle code was changed. `REVIEW` semantics, categories, threshold, and the local-only provider contract are unchanged.

## Before/after category metrics

Counts use `TP/FP/TN/FN` for category labels; ambiguous items are excluded. Values are descriptive; small support makes perfect scores uninformative. Harassment is the only category with positive support in either V8 split; hate, threats, and spam have zero positives and zero false positives.

| Split | Category | n clear | TP/FP/TN/FN | P/R/F1 |
| --- | --- | ---: | --- | --- |
| V8 development | Harassment | 13 | 8/0/5/0 | 1.000/1.000/1.000 |
| V8 development | Hate | 13 | 0/0/13/0 | n/a/n/a/n/a |
| V8 development | Threats | 13 | 0/0/13/0 | n/a/n/a/n/a |
| V8 development | Spam | 13 | 0/0/13/0 | n/a/n/a/n/a |
| V8 held-out | Harassment | 11 | 5/0/6/0 | 1.000/1.000/1.000 |
| V8 held-out | Hate | 11 | 0/0/11/0 | n/a/n/a/n/a |
| V8 held-out | Threats | 11 | 0/0/11/0 | n/a/n/a/n/a |
| V8 held-out | Spam | 11 | 0/0/11/0 | n/a/n/a/n/a |

Per-language harassment counts (`TP/FP/TN/FN`): development Arabic `n=5`: `3/0/2/0`; development English `n=8`: `5/0/3/0`; held-out Arabic `n=4`: `2/0/2/0`; held-out English `n=7`: `3/0/4/0`. Mixed and Arabizi support is zero in V8.

The same change measured against the frozen V7 held-out split (no V7 labels or texts were touched): harassment moved from `3/0/4/1` (P/R/F1 `1.000/0.750/0.857`) to `4/0/4/0` (`1.000/1.000/1.000`), with zero new false positives and the previously recorded miss `v7t-en-report-then-attack` now resolving to HIDE as expected. All other V7 categories are unchanged.

Operational action matrix (expected rows, actual columns) on clear items:

| Split | ALLOW row: ALLOW/HIDE/REVIEW | HIDE row: ALLOW/HIDE/REVIEW | REVIEW row |
| --- | --- | --- | --- |
| V8 development, n=13 | 5/0/0 | 0/8/0 | empty |
| V8 held-out, n=11 | 6/0/0 | 0/5/0 | empty |

## Documented residual false-positive risk

`v8t-en-clown-benign-frame` ("He's a clown at parties.") is labeled ambiguous because the benign framing clause makes the category truth unassignable from text alone; the engine auto-hides it (`expected=REVIEW, actual=HIDE`, excluded from metrics). This is an accepted, documented FP risk of the shared `clown` token, consistent with the identical second-person treatment; it was not tuned away, and its disposition is deferred to the contextual layer rather than handled by rule broadening. The isolated skill form `He's hopeless at presentations.` stays allowed, while the bare `He's hopeless.` is labeled ambiguous and correctly abstains.

## Error analysis and next work

- **Fixed:** direct third-person degradation in English and Egyptian Arabic (present-tense copula forms), authored insults inside first-person reports, authored third-person attacks after reported sentences, and attributed third-person opinions — all without new false positives on the V7 and V8 splits or the 59-item classification corpus.
- **Still unsupported (recorded, not tuned):** third-person plural (`they're pathetic`), past tense (`he was an idiot`), Arabizi third person (`howa fashel`), Arabic-clitic pronouns (`فهو فاشل`), the `he's the idiot` determiner form (also uncovered for second person), insults with the target omitted, hate against actual protected identities, wider Arabizi and dialect coverage, and spam intent in legitimate promotion contexts.
- **No plateau claim:** V8 is the first cycle of the rules-first phase with measurable held-out gain, so the exit gate (2-3 consecutive negligible-gain cycles) is not approached. Threats, spam, typo normalization, Arabizi variation, and semantic rule IDs remain planned cycles per `docs/ROADMAP.md`; hate remains blocked on policy definition, an identity-target taxonomy, and independently reviewed data (P0).

## Exit gate

Do not begin any model comparison based on V8 scores. The standing exit-gate requirements are unchanged: independently annotated, consent-safe examples across Arabic dialects, English, mixed text, and Arabizi; two blinded reviewers with adjudication; a frozen test split authored before tuning; category/language action and label metrics with support; and stable high precision without disproportionate false positives on criticism, counterspeech, reporting, and legitimate promotion.

## Validation

The extension suite passed (20 files, 421 tests, including the new V8 eval harness, 8 third-person positive regressions, 10 protected-negative regressions, and 2 first-person cognition regressions); TypeScript compilation and production build passed; `verify-dist` passed within the build; backend pytest passed (33 tests); and the pre-change baseline commit (`7303cbf`) preserves the frozen V1-V7 assets this cycle builds on.
