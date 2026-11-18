# V9 rule-engine cycle: additional high-confidence injury constructions

## Scope and evidence

V1–V8 frozen assets were not edited. V9 has 16 synthetic development examples (14 clear, 2 ambiguous) and 12 synthetic held-out examples (11 clear, 1 ambiguous), authored by one contributor before implementation; see [`RULE_ENGINE_V9_PLAN.md`](RULE_ENGINE_V9_PLAN.md), [`rule-engine-v9-dev.json`](rule-engine-v9-dev.json), and [`rule-engine-v9-test.json`](rule-engine-v9-test.json). There were no independent reviewers, adjudication, external sampling, or production comments; all V9 outcomes are exploratory single-author evidence. Trigram split-leakage and unique-ID checks passed; they cannot detect paraphrase or shared-author leakage. No label corrections occurred after first scoring.

The cycle extends one closed vocabulary: first-person injury threats with an explicit human object. The plan estimated the new rule IDs as `threats.6`/`threats.7`; after implementation the actual appended IDs were verified as `threats.7` (English) and `threats.8` (Arabic) because six threat patterns already existed. That estimate, not any label, was corrected; legacy IDs `threats.2` and `threats.4` are unchanged and locked by regression tests.

## Pre-change dev failures (recorded before implementation)

The dev/hold-out harness was run against the pre-change policy before any rule edit:

- Development: threats `TP=0 FP=0 TN=8 FN=6` (`P=n/a R=0.000 F1=0.000`).
- Frozen held-out: threats `TP=0 FP=0 TN=6 FN=5`.

All six development positives and all five held-out positives failed, while all 14 clear negatives passed. Zero false positives were present before the change, so preserving that number was the hard acceptance constraint.

## Prioritized findings and code traces

1. **Two appended injury patterns, closed object vocabulary.** English (`threats.7`) covers the existing first-person future-intent forms with `choke + you/him/her/them`, `knock + possessive + teeth out`, and `break + possessive + face/skull`. Arabic (`threats.8`) covers `هخنق + personal object suffix (ك/ها/هم/ه)` with a trailing boundary. No general verb, fuzzy matching, or new future-intent grammar was added. `knock your socks off`, `break the build/fall`, `choke on coffee/the process/the noise`, and a bare `هخنق العملية` stay visible because the object vocabulary is closed.
2. **Negation suppression extended narrowly.** The attested Arabic negation replacement now includes `هخنق` with an optional trailing ش (`ما هخنقكش`) in both the main and `ولا`-chained alternatives; without it, `مش هخنقك` would have been a new false positive because the pattern's boundary check ignores the preceding negation word. Existing negation forms and the Arabizi replacement were not altered.
3. **Attribution unchanged.** `قال/قالت` and English reporting cues continue to suppress the governed sentence; reported choking threats (`قال هخنقك`, `She said she would choke you`) stay visible with no new cue grammar.

No DOM, hiding, reveal, threshold, categories, or provider-contract code changed.

## Before/after category metrics

Counts use `TP/FP/TN/FN` for category labels; ambiguous items are excluded. Values are descriptive; small support makes perfect scores uninformative. Threats is the only category with V9 positive support; harassment, hate, and spam have zero positives and zero false positives.

| Split | Category | n clear | Before TP/FP/TN/FN | Before P/R/F1 | After TP/FP/TN/FN | After P/R/F1 |
| --- | --- | ---: | --- | --- | --- | --- |
| V9 development | Threats | 14 | 0/0/8/6 | n/a/0.000/0.000 | 6/0/8/0 | 1.000/1.000/1.000 |
| V9 development | Harassment/Hate/Spam | 14 | 0/0/14/0 | n/a/n/a/n/a | 0/0/14/0 | n/a/n/a/n/a |
| V9 held-out | Threats | 11 | 0/0/6/5 | n/a/0.000/0.000 | 5/0/6/0 | 1.000/1.000/1.000 |
| V9 held-out | Harassment/Hate/Spam | 11 | 0/0/11/0 | n/a/n/a/n/a | 0/0/11/0 | n/a/n/a/n/a |

Per-language threats counts after the change (`TP/FP/TN/FN`): development English `n=6`: `3/0/3/0`; development Arabic `n=6`: `2/0/4/0`; development mixed `n=2`: `1/0/1/0`; held-out English `n=7`: `3/0/4/0`; held-out Arabic `n=3`: `1/0/2/0`; held-out mixed `n=1`: `1/0/0/0`. Arabizi support is zero in V9.

The same change against the frozen V7 and V8 splits produced no action changes in any category: their threat items use already-covered forms and their negatives remain negative.

Operational action matrix (expected rows, actual columns) on clear items:

| Split | ALLOW row: ALLOW/HIDE/REVIEW | HIDE row: ALLOW/HIDE/REVIEW | REVIEW row |
| --- | --- | --- | --- |
| V9 development, n=14 | 8/0/0 | 0/6/0 | empty |
| V9 held-out, n=11 | 6/0/0 | 0/5/0 | empty |

## Documented residual false-positive risk

Three banter items are labeled ambiguous because an explicit joke/match/kidding frame makes real injury intent unassignable from isolated text: `v9d-en-choking-banter`, `v9d-ar-match-banter`, and `v9t-en-kidding-frame`. The engine auto-hides all three (`expected=REVIEW, actual=HIDE`, excluded from metrics). This is the same accepted risk class as V8's `He's a clown at parties.` and is deferred to the contextual layer; it was not tuned away by adding a special-case joke exemption, which would risk suppressing genuine threats.

## Error analysis and next work

- **Fixed:** six development and five held-out high-confidence injury threats across English, Egyptian Arabic, and mixed script, with zero new false positives on V7/V8/V9 splits or the 59-item classification corpus.
- **Still unsupported (recorded, not tuned):** `you're dead`/idiomatic threats without first-person future intent, additional Arabizi injury verbs, past-tense injury narratives with personal objects, and intent discrimination in banter/sarcasm. Third-person harassment variants, spam openers, typo normalization, Arabizi expansion, and semantic rule IDs remain planned per `docs/ROADMAP.md`. Hate remains blocked on policy definition, an identity-target taxonomy, and independently reviewed data (P0).
- **No plateau claim:** two rule cycles now show non-negligible held-out gains (V8 third-person abuse, V9 injury predicates). The exit gate requires 2–3 consecutive negligible-gain cycles with no regressions; it is not approached.

## Exit gate

Unchanged from V7/V8: no model comparison before independently annotated, consent-safe examples with two blinded reviewers, adjudication, a frozen test split authored before tuning, per-category/per-language metrics with support, and demonstrated low false-positive harm on criticism, counterspeech, reporting, and legitimate promotion.

## Validation

The extension suite passed (21 files, 441 tests, including the new V9 eval harness, 6 injury-threat positives, 11 protected negatives, and rule-ID stability checks); TypeScript compilation and production build passed; `verify-dist` passed within the build; backend pytest passed (33 tests); and the pre-change baseline commit (`7303cbf`) plus the frozen V1–V8 assets underpin this cycle.
