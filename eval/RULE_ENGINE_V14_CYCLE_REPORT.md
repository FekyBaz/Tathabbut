# V14 rule-engine cycle: negation guard for legacy Arabizi patterns

## Scope and evidence

V1–V13 frozen datasets were not edited; two legacy pattern **bodies** inside
`policy.ts` were tightened in place (their positional IDs are unchanged).
V14 has 13 synthetic development examples (11 clear, 2 ambiguous) and 9
synthetic held-out examples (8 clear, 1 ambiguous), authored by one contributor
before implementation; see [`RULE_ENGINE_V14_PLAN.md`](RULE_ENGINE_V14_PLAN.md),
[`rule-engine-v14-dev.json`](rule-engine-v14-dev.json), and
[`rule-engine-v14-test.json`](rule-engine-v14-test.json). No independent
reviewers, adjudication, external sampling, or production comments; outcomes
are exploratory single-author evidence. Unique-ID and trigram split-leakage
checks passed. No post-scoring label corrections occurred.

The cycle fixes one documented precision defect: the two older Arabizi
harassment patterns (`enta/inti/entu + ghaby/ghabi/ahbal` and `enta + faker`)
lack the negation guard added to the V12 patterns, so explicitly negated
insults (`mish enta ghaby`, `mesh enta faker`) were auto-hidden.

## Pre-change baseline (recorded before implementation)

Development harassment `TP=4 FP=5 TN=2 FN=0` (`P=0.444 R=1.000 F1=0.615`);
held-out harassment `TP=4 FP=3 TN=1 FN=0` (`P=0.571 R=1.000 F1=0.727`).
Unlike earlier cycles, this baseline has **real false positives** — the gain
is in precision, not recall. All four clear positives already passed.

## Prioritized findings and code traces

1. **Narrow guard added in place.** `(?<!\b(?:mish|mesh|msh)\s+)` was prepended
   to the two legacy patterns. They were neither moved nor replaced:
   `harassment.16` and `harassment.17` are unchanged and locked by regression
   tests. No other pattern, rule ID, or category was touched.
2. **Guard is clause-local, not global.** Hard positives `mish ana ghaby, enta
   ghaby` and `msh ana faker, enta faker` still hide: the lookbehind checks
   only the word immediately before each pronoun, so negation of a
   self-description does not suppress a later authored insult.
3. **Blast-radius verified.** Frozen V7–V13 harnesses report no action changes,
   the 59-item classification corpus stays green, and English negation
   (`I'm not an idiot`) is unaffected.

Arabic-script negation (e.g. `مش انت غبي`), vocative insults, and joke/banter
frames remain out of scope and recorded as residual gaps; no exception list
was added for them.

## Before/after category metrics

Counts use `TP/FP/TN/FN` for category labels; ambiguous items are excluded.

| Split | Category | n clear | Before TP/FP/TN/FN | Before P/R/F1 | After TP/FP/TN/FN | After P/R/F1 |
| --- | --- | ---: | --- | --- | --- | --- |
| V14 development | Harassment | 11 | 4/5/2/0 | 0.444/1.000/0.615 | 4/0/7/0 | 1.000/1.000/1.000 |
| V14 development | Others | 11 | 0/0/11/0 | n/a/n/a/n/a | 0/0/11/0 | n/a/n/a/n/a |
| V14 held-out | Harassment | 8 | 4/3/1/0 | 0.571/1.000/0.727 | 4/0/4/0 | 1.000/1.000/1.000 |
| V14 held-out | Others | 8 | 0/0/8/0 | n/a/n/a/n/a | 0/0/8/0 | n/a/n/a/n/a |

Per-language after the change (`TP/FP/TN/FN`): development Arabizi `n=8`:
`3/0/5/0`; development mixed `n=1`: `1/0/0/0`; development English control
`n=2`: `0/0/2/0`; held-out Arabizi `n=7`: `3/0/4/0`; held-out English control
`n=1`: `0/0/1/0`. Support is small and synthetic; these are not accuracy claims.

Operational action matrix (expected rows, actual columns) on clear items:

| Split | ALLOW row: ALLOW/HIDE/REVIEW | HIDE row: ALLOW/HIDE/REVIEW | REVIEW row |
| --- | --- | --- | --- |
| V14 development, n=11 | 7/0/0 | 0/4/0 | empty |
| V14 held-out, n=8 | 4/0/0 | 0/4/0 | empty |

## Documented residual false-positive risk

Three ambiguous joke-frame items (`v14d-ar-joke-ghaby`, `v14d-ar-joke-faker`,
`v14t-ar-joke`) still auto-hide (`expected=REVIEW, actual=HIDE`, excluded from
metrics). They belong to the 16+ accumulated contextual FP-risk cases that
require independent annotated data rather than another exception rule.

## Error analysis and next work

- **Fixed:** eight negated-insult false positives (five dev, three held-out)
  with zero new false negatives and zero legacy ID changes.
- **Still unsupported (recorded, not tuned):** negation in Arabic-script
  harassment patterns, vocative negation, joke/satire frames, omission typos
  beyond the reviewed alias, identity-targeted hate, and semantic rule IDs
  (technical cleanup). Phase 2 still requires independently annotated,
  consent-safe data across discourse types.
- **No plateau claim:** seven consecutive cycles (V8–V14) each produced a
  measurable held-out gain, now including a precision gain. The exit gate
  remains closed; see [`RULE_ENGINE_CEILING_ASSESSMENT.md`](RULE_ENGINE_CEILING_ASSESSMENT.md).

## Exit gate

Unchanged: no model comparison before independently annotated, consent-safe
examples with two blinded reviewers, adjudication, a frozen split authored
before tuning, per-category/per-language metrics with support, and demonstrated
low false-positive harm on criticism, counterspeech, reporting, and legitimate
promotion.

## Validation

The extension suite passed (26 files, 523 tests, including the V14 eval harness
and 11 new policy regressions); TypeScript compilation and production build
passed; `verify-dist` passed within the build; backend pytest passed (33
tests); frozen V7–V13 harnesses report no action errors; and the pre-change
baseline commit (`7303cbf`) plus all frozen V1–V13 assets underpin this cycle.
