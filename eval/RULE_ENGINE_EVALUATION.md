# Rule engine evaluation record

## Dataset and interpretation

`rule-engine-dev.json` and `rule-engine-heldout.json` are separate synthetic, hand-authored datasets. Every item has an explicit category label set, language tag, clear/ambiguous status, and rationale. The evaluator excludes ambiguous items from precision, recall, and F1, and reports how many ambiguous cases each category rule set covers. The evaluator also reports per-language, per-category counts and exact-label agreement.

The development split contains 23 examples (21 clear, 2 ambiguous); the held-out split contains 23 (21 clear, 2 ambiguous). Clear-case numbers are descriptive only: the sample is much too small to establish reliable real-world performance. A category with no positive cases has undefined precision, recall, and F1 and is printed as `n/a`, rather than being treated as perfect.

The existing `classification-corpus.test.ts` has 59 embedded examples (despite its 60-example comment); it remains a regression suite and is not either evaluation split.

## Audit baseline

Before the changes in this work, the existing shared 31-item evaluation set produced:

| Category | TP | FP | TN | FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Harassment | 6 | 2 | 23 | 0 | 0.750 | 1.000 | 0.857 |
| Hate | 2 | 0 | 29 | 0 | 1.000 | 1.000 | 1.000 |
| Threats | 4 | 0 | 27 | 0 | 1.000 | 1.000 | 1.000 |
| Spam | 5 | 0 | 26 | 0 | 1.000 | 1.000 | 1.000 |

The two harassment false positives were disclosed non-strict quoted/reporting examples. All 28 strict examples matched, but the dataset is tiny and its hate examples use the literal placeholder `group`; that category result is not evidence of general hate detection.

## Changes and measured effects

1. **Explicit Egyptian Arabic negation for threats.** Development examples initially produced 3 false positives from `مش هقتلك` / `مش هضربك` constructions. A narrow suppression for explicit `مش` / `ما` negation was added for listed threat forms. On the shared original development examples, threats changed from TP=2, FP=3, TN=13, FN=0 to TP=2, FP=0, TN=16, FN=0. On the original held-out examples, threats changed from TP=2, FP=1, TN=15, FN=0 to TP=2, FP=0, TN=16, FN=0. Direct unnegated threats remain covered.

2. **Arabic reporting phrase.** Added recognition of the specific `نقل عنه قوله` / `نقلت عنه قولها` reporting construction. It protects a reported threat and the existing reported Arabic insult example. This reduces one known harassment false positive in the original 31-item set: TP=6, FP=2, TN=23, FN=0 becomes TP=6, FP=1, TN=24, FN=0 (precision 0.857, recall 1.000, F1 0.923). One English educational mention remains a false positive.

3. **Common English intensifier.** A direct second-person insult with `complete` or `total` is now recognized. The development miss `You're a complete idiot!` changes from FN=1 to TP=1 for harassment; no false positive appeared in held-out cases.

4. **Narrow Arabizi harassment phrases.** Added whole-phrase `enta/int(i)/entu + ghaby/ghabi/ahbal` and `ya + 7mar/7omar/hamar` patterns, supported by development examples. The held-out `ya 7mar` is detected, and its non-abusive Arabizi threat-negation control remains visible. This is a tiny proof of coverage, not broad Arabizi support.

5. **Explainability.** Local classifications now carry matching category, pattern-order rule ID, and a category-level reason. IDs are append-only by pattern position. The score, categories, threshold, remote schema acceptance, and DOM handling are unchanged.

## Final split scores

Counts below use the final split versions, including the added Arabizi and spelling-variation items. The one harassment false negative in each split is the deliberately included repeated-character / typo case (`idiooot`, `idot`). There are no clear-case false positives in either split.

| Split/category | TP | FP | TN | FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Development harassment | 5 | 0 | 15 | 1 | 1.000 | 0.833 | 0.909 |
| Development threats | 2 | 0 | 19 | 0 | 1.000 | 1.000 | 1.000 |
| Development spam | 1 | 0 | 20 | 0 | 1.000 | 1.000 | 1.000 |
| Development hate | 0 | 0 | 21 | 0 | n/a | n/a | n/a |
| Held-out harassment | 5 | 0 | 15 | 1 | 1.000 | 0.833 | 0.909 |
| Held-out threats | 2 | 0 | 19 | 0 | 1.000 | 1.000 | 1.000 |
| Held-out spam | 1 | 0 | 20 | 0 | 1.000 | 1.000 | 1.000 |
| Held-out hate | 0 | 0 | 21 | 0 | n/a | n/a | n/a |

Per-language exact-label agreement on clear items: development Arabic 10/10, English 7/8, mixed 2/2, Arabizi 1/1; held-out Arabic 8/8, English 8/9, mixed 2/2, Arabizi 2/2. The English miss in each split is the repeated-letter/typo harassment example. Counts are too low for language-level performance claims. Ambiguous examples left unresolved: 2 per split; the current rules cover 1/2 development examples and 0/2 held-out examples, but that coverage is not a correctness score because their labels are inherently context-dependent.

## Error analysis and exit-gate assessment

- **Remaining deterministic gaps:** repeated-character and misspelled insults, incomplete Arabizi spellings, wider Egyptian dialect variation, and unlisted phrase forms. Fuzzy matching or aggressive character folding could catch some but risks false positives and needs a broader contrastive dataset first.
- **Weak category coverage:** hate has no useful general target taxonomy; the existing literal placeholder pattern is not substantive coverage. Spam remains limited to specific solicitation phrases and repeated links. Threats work for listed direct English/Egyptian phrases; broad conditional, quoted, ironic, and multi-clause threat interpretation remains brittle.
- **Context limits:** whether a phrase is sarcastic, reclaimed, playful, quoted without explicit report cues, or directed at a person versus an idea can require surrounding conversation and speaker intent. Deterministic rules can protect known quotation/report forms but cannot resolve these cases reliably in general.
- **Plateau:** not established. The measured held-out gains (one threat false positive removed and one Arabizi positive recognized) show additional deterministic value remains. At the same time, held-out sample size is only 21 clear cases, with zero hate positives and one spam positive, so neither a ceiling nor robust category reliability can be inferred.
- **Recommended exit criteria:** build a substantially larger, independently annotated and consent-safe corpus with at least hundreds of examples per important category and language/dialect slice, hard negatives, and adjudicated ambiguity; freeze a truly untouched test set; require category-specific minimum precision and recall with confidence intervals and explicit false-positive budgets; compare each rule batch against that frozen set; and call a plateau only after multiple evidence-driven batches show negligible held-out gains without regressions. Hate coverage needs a clear policy and valid labeled targets before it can be measured.

## Validation

Recorded commands: `extension/npm test`, `extension/npm run build` (includes `tsc --noEmit` and `verify-dist.mjs`), `backend/python -m pytest`, and `git diff --check`. Results are summarized in the task response.

## Evaluation expansion v2 (frozen before scoring)

The v1 held-out set is historical because it was used during earlier tuning. The v2 datasets contain 32 clear examples each: 8 per category, with 4 positives and 4 hard negatives per category, distributed evenly across Arabic, English, mixed text, and Arabizi. The frozen test contains no ambiguous cases. Provenance, category policy, annotation steps, and metric rules are in `ANNOTATION_GUIDELINES.md`. A new integrity test checks IDs, canonicalized text equality, and cross-split token-bigram Jaccard similarity (threshold 0.80), including against the previously inspected v1/shared evaluation items.

No classification rules were changed in this expansion cycle. The new split was scored once after freezing the examples; its errors are recorded as future development work, not used to tune this test set. The data are synthetic and authored by the implementation team, not independently annotated, so “frozen test” means untouched by this cycle's rule tuning—not independent or representative evidence.

| Split/category | Pos support | Neg support | TP | FP | TN | FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Dev harassment | 4 | 28 | 4 | 0 | 28 | 0 | 1.000 | 1.000 | 1.000 |
| Dev threats | 4 | 28 | 3 | 0 | 28 | 1 | 1.000 | 0.750 | 0.857 |
| Dev hate | 4 | 28 | 0 | 0 | 28 | 4 | n/a | 0.000 | 0.000 |
| Dev spam | 4 | 28 | 2 | 0 | 28 | 2 | 1.000 | 0.500 | 0.667 |
| Frozen test harassment | 4 | 28 | 4 | 0 | 28 | 0 | 1.000 | 1.000 | 1.000 |
| Frozen test threats | 4 | 28 | 3 | 0 | 28 | 1 | 1.000 | 0.750 | 0.857 |
| Frozen test hate | 4 | 28 | 0 | 0 | 28 | 4 | n/a | 0.000 | 0.000 |
| Frozen test spam | 4 | 28 | 3 | 0 | 28 | 1 | 1.000 | 0.750 | 0.857 |

Both splits have 32 clear cases and zero ambiguous items. Per-language exact category-set agreement: development Arabic 7/8, English 7/8, mixed 6/8, Arabizi 5/8; frozen test Arabic 7/8, English 7/8, mixed 7/8, Arabizi 5/8. Within every language slice, harassment is TP=1, FP=0, TN=7, FN=0; hate is TP=0, FP=0, TN=7, FN=1. Threats are TP=1, FP=0, TN=7, FN=0 for Arabic, English, and mixed in both splits, and TP=0, FP=0, TN=7, FN=1 for Arabizi. Spam is TP=1, FP=0, TN=7, FN=0 for Arabic and English in both splits; development mixed and Arabizi are each TP=0, FP=0, TN=7, FN=1, while frozen-test mixed is TP=1, FP=0, TN=7, FN=0 and Arabizi is TP=0, FP=0, TN=7, FN=1. These per-language denominators are only eight cases per category and language.

## v2 prioritized error analysis

1. **Hate false negatives (P0):** all four clear positives are missed in both splits (`v2d-hate-*p1`, `v2t-hate-*p1`); all 28 hard negatives per split remain visible. This is consistent with the placeholder-only rule. The current corpus cannot justify a general identity lexicon or broad template rule; define a reviewed target vocabulary and collect substantially more contrastive cases before implementation.
2. **Arabizi threats (P1):** one direct transliterated threat is missed in each split (`v2d-t-ab-p1`, `v2t-t-ab-p1`); the other three language strata each detect their one positive. A broader transliteration rule needs more spelling variants, negated controls, and report/quotation negatives before a change is safe.
3. **Spam variants (P1):** development misses one mixed-language (`v2d-s-mix-p1`) and one Arabizi solicitation (`v2d-s-ab-p1`); test misses one Arabizi solicitation (`v2t-s-ab-p1`). Arabic and English examples are detected. Phrase expansions need matched benign “message privately,” prize discussion, and ordinary marketing controls.
4. **False positives:** none on these 32-item splits. With only 28 negatives per category and language strata of eight, this does not establish a low production false-positive rate.
5. **Harassment:** no errors among the selected direct insult positives and criticism hard negatives. The data do not cover repeated targeting over time, sarcasm, reclaimed language, or broad spelling variation.

These results show concrete deterministic gaps and no plateau. They do not justify claiming high category reliability: hate recall is zero, and threat/spam positive support is four per split. No new rule change is supported as safe without another development cycle with richer controls and a newly frozen test set.

## Evaluation cycle v3

The v2 failure inventory, code-traced causes, and fix decisions are in `RULE_ENGINE_V3_FAILURE_ANALYSIS.md`. The v3 development set contains 35 clear examples; the frozen test has 32 clear examples. Each category has four positives and hard negatives in each split, stratified across Arabic, English, mixed, and Arabizi, with no ambiguous cases. Integrity tests check IDs, annotations, canonical exact matches, and token-bigram similarity against v3 dev and all prior scored corpora. The synthetic sets are single-author; they are separate and frozen, but are not independently human-authored.

### V3 development before and after

| Category | Pos | Neg | Before TP/FP/TN/FN | After TP/FP/TN/FN | Before F1 | After F1 |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| Harassment | 4 | 31 | 3 / 0 / 31 / 1 | 4 / 0 / 31 / 0 | 0.857 | 1.000 |
| Threats | 4 | 31 | 2 / 0 / 31 / 2 | 3 / 0 / 31 / 1 | 0.667 | 0.857 |
| Hate | 4 | 31 | 0 / 0 / 31 / 4 | 0 / 0 / 31 / 4 | 0.000 | 0.000 |
| Spam | 4 | 31 | 1 / 0 / 31 / 3 | 4 / 0 / 31 / 0 | 0.400 | 1.000 |

There were no development false positives. V3 fixes cover the `ya ahbal` vocative, three narrowly attested Arabizi threat verbs with matched negation and attribution handling, mixed reward/private-claim composition, and one Arabizi prize-claim form. A context cue no longer truncates comments merely because they contain the word `phrase`; explicit discussion of an insult remains protected by a more specific cue. Exact rule rationale and controls are in the failure-analysis report.

### V3 frozen-test results

| Category | Pos | Neg | TP | FP | TN | FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Harassment | 4 | 28 | 4 | 0 | 28 | 0 | 1.000 | 1.000 | 1.000 |
| Threats | 4 | 28 | 4 | 0 | 28 | 0 | 1.000 | 1.000 | 1.000 |
| Hate | 4 | 28 | 0 | 0 | 28 | 4 | n/a | 0.000 | 0.000 |
| Spam | 4 | 28 | 3 | 0 | 28 | 1 | 1.000 | 0.750 | 0.857 |

Per-language exact-label agreement: development Arabic 7/8, English 7/9, mixed 7/8, Arabizi 9/10; frozen test Arabic 7/8, English 7/8, mixed 7/8, Arabizi 6/8. Every slice has zero false positives in this small corpus. In frozen test, each language's hate slice is TP=0, FP=0, TN=7, FN=1; threats are TP=1, FP=0, TN=7, FN=0 in every language; spam is TP=1, FP=0, TN=7, FN=0 for Arabic, English, and mixed, and TP=0, FP=0, TN=7, FN=1 for Arabizi. Harassment is TP=1, FP=0, TN=7, FN=0 in every language. The single test spam miss uses `enta kasabt` instead of the development-supported `mabrook/mabrouk kasabt` opener; it is recorded for a future cycle and was not tuned against.

### Exit-gate update

The v3 frozen test detected all four threat positives, compared with three of four in the v2 challenge; spam remained at three of four and the Arabizi miss remains. These separate synthetic sets are not a controlled estimate of generalization or a plateau. Hate remains at zero recall because the current policy's only pattern still uses a literal placeholder and a general identity lexicon is not justified by four examples per split. More deterministic gains remain plausible for group-target hate templates and Arabizi spam variants, but the next cycle needs independently annotated examples, an expanded hate hard-negative set, and a new test split before any changes.

## Evaluation cycle V4 (generalization and gap cycle)

V4 development (43 clear items) and frozen test (36 clear items) were separately drafted before rule edits; both include provenance and rationale per case. Automated integrity checks reject canonical exact duplicates and token-bigram Jaccard similarity >=0.80 across the new split and every earlier corpus, including the frozen V2/V3 files. V2/V3 data remain unchanged. All V4 examples are synthetic and single-author; no second reviewer was available, so labels are not independently reviewed or adjudicated. The split is a frozen challenge set, not a representative or independent-human test. See `ANNOTATION_GUIDELINES.md` and `RULE_ENGINE_V4_ERROR_ANALYSIS.md` for operational policy, complete per-language counts, and failure traces.

### V4 development measurements

| Category | Pos / Neg | Before TP/FP/TN/FN | After TP/FP/TN/FN | After P | After R | After F1 |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| Harassment | 4 / 39 | 2 / 0 / 39 / 2 | 2 / 0 / 39 / 2 | 1.000 | 0.500 | 0.667 |
| Hate | 4 / 39 | 0 / 0 / 39 / 4 | 0 / 0 / 39 / 4 | n/a | 0.000 | 0.000 |
| Threats | 3 / 40 | 2 / 0 / 39 / 1 | 3 / 0 / 40 / 0 | 1.000 | 1.000 | 1.000 |
| Spam | 2 / 41 | 1 / 0 / 40 / 1 | 2 / 0 / 41 / 0 | 1.000 | 1.000 | 1.000 |

Threat comparison uses the final V4 development set and its added reported-joke negative; the equivalent 42-item pre-fix data had 2/0/38/1 before and 3/0/38/0 after. Spam's comparable pre-fix data had 1/0/40/1; adding the V4-supported `enta kasabt` construction detects both positives without false positives. Development error logs and per-language counts are in the V4 report.

### V4 frozen-test measurements

| Category | Pos / Neg | TP / FP / TN / FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Harassment | 4 / 32 | 3 / 0 / 32 / 1 | 1.000 | 0.750 | 0.857 |
| Hate | 4 / 32 | 0 / 0 / 32 / 4 | n/a | 0.000 | 0.000 |
| Threats | 1 / 35 | 1 / 0 / 35 / 0 | 1.000 | 1.000 | 1.000 |
| Spam | 2 / 34 | 2 / 0 / 34 / 0 | 1.000 | 1.000 | 1.000 |

The V4 changes target one English body-part harm grammar and one Arabizi prize-solicitation opener; these small challenge results support those specific changes only. Hate remains unhandled: the current rule is a placeholder requiring literal `group`, and no implementation change was justified from one positive per script and one annotator. The V4 threat test initially exposed a joking-quotation FP; a narrow report/joke cue was tested against a new development negative before the test was scored again with the final implementation. No V4 files changed after final test scoring.

The evidence does not establish a rule-engine plateau. More deterministic gains are demonstrated for the two specific constructions, while hate, broader harassment, transliteration variants, implicit threats, and context-dependent endorsement remain gaps. Independent blinded annotation, substantially larger per-category and per-language support, adjudication, and successive untouched test cycles with confidence intervals and predeclared false-positive budgets are required before a plateau claim. Do not treat the V4 metrics as real-world accuracy.

## V5 annotation readiness and harassment follow-up

The V5 audit found no independent annotators or suitable consented corpus available. The independent review protocol is now specified in `ANNOTATION_GUIDELINES.md`: two blinded fluent annotators, third blinded adjudicator, retained individual labels and rationales, ambiguity handling, provenance, and split blinding. V4 categories follow the written policy in the sampled cases, but the identity scope needs policy clarification and the very small, synthetic set cannot establish label consistency. Exact hate-rule mechanism and V4 harassment failure traces are in `RULE_ENGINE_V5_READINESS.md`.

V5b harassment development baseline: n=16, TP/FP/TN/FN `1/0/12/3`, P=1.000, R=0.250, F1=0.400. Final development: `4/0/12/0`, P/R/F1=1.000. Per-language baseline-to-final counts (TP/FP/TN/FN): Arabic `1/0/3/0` → `1/0/3/0`; English `0/0/3/1` → `1/0/3/0`; mixed `0/0/3/1` → `1/0/3/0`; Arabizi `0/0/3/1` → `1/0/3/0`. Changes narrowly add attested English fraud/joke targeting, a mixed Arabic pronoun plus English insult, the normalized Arabic vocative in English framing, and Arabizi `enta faker`; contrastive tests protect product/code/argument criticism and attributed use.

V5 test candidates were inadvertently scored with baseline rules before tuning (the evaluation command included both metric tests). Their outcomes were not used to choose or revise rules, but prior exposure means they are not clean untouched post-change evidence. Their final scores are excluded from generalization claims. V5 labels are single-author synthetic; no labels are independently reviewed or adjudicated. The V5 result is a development regression gain only, not independent validation. Hate rules remain unchanged and are not ready for evaluation of a candidate detector; no category reaches the evidence threshold for a broad model-quality comparison. Narrow controlled experiments should wait for a clean independently reviewed dataset and test split.
