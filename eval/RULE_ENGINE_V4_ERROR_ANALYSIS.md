# Rule engine V4 generalization cycle

## Root-cause hypotheses and supported changes

V2/V3 frozen files were not edited or used to choose rule changes. New V4 development and frozen-test examples were drafted before implementation changes and screened against one another and all earlier corpora by canonical exact match and adjacent-token-bigram Jaccard (<0.80). Annotation is single-author synthetic challenge data, not independent human review; see `ANNOTATION_GUIDELINES.md`.

| Gap / hypothesis | Development evidence before → after | Controls and regressions | Decision |
| --- | --- | --- | --- |
| English body-part threat miss is a missing grammatical construction: future first-person intent + break/smash + possessive + named body part. | V4 dev: threats TP/FP/TN/FN `2/0/39/1` → `3/0/40/0` (one extra dev hard negative was added with the targeted quote/joke probe). On the comparable 42-item pre-fix version: `2/0/38/1` → `3/0/38/0`. | Negation, quoted report, joke/performance report, technical `break the build`, idiom `break a leg`, object target. Frozen-test regression surfaced a joking quotation FP; added a narrow `he/she/they/someone joked|quipped` + quoted body-threat cue supported by a new dev negative. After cue, V4 test threats are `1/0/35/0`. | Keep narrow rule and report cue. No evidence for broad `break` matching or other injury vocabulary. |
| V3 Arabizi spam miss shares its `enta kasabt` opening with V4 solicitation; the missing pattern is a supported opener variant, not a need for fuzzy transliteration. | V4 dev before: spam `1/0/40/1` (one supported positive among 2; second was a legacy-supported `mabrook` case), after: `2/0/41/0` with added positive/negative contrasts. | Controls include past school prize, public promotion, benign private address/file request, and prize mention followed by unrelated private contact. No FN/FP in final V4 dev. Frozen test `2/0/34/0`. | Keep the added exact `enta kasabt` opening only when reward + private contact + claim/collection cues all occur. Feminine transliteration forms were explored and removed from the scored data/rule due insufficient evidence. |
| Hate has zero recall because the only rule still requires the literal placeholder `group`; it has no reviewed identity vocabulary or Arabic/mixed/Arabizi grammar. | V4 dev hate `0/0/39/4`; V4 frozen test `0/0/32/4`. | Hard negatives include policy/institution criticism, identity mention, counterspeech, equal-rights affirmations, and a distinction between policy and people. | No code change. Existing policy is explicit; the data are single-author and small, and a hand-built identity lexicon risks overreach. Commission independent review, expand examples per identity and attack construction, then consider phrase-level rules. |

## Measured V4 results

Metrics are one-vs-rest, clear cases only. `n` is positive+negative support. All P/R/F1 are undefined when there are no predicted positives, as for hate. Each split contains 0 ambiguous items. FP/FN are raw category decisions. Sample sizes are small, synthetic, and not estimates of real-world prevalence.

### Development after V4 changes (43 items)

| Category | Pos / Neg | TP / FP / TN / FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Harassment | 4 / 39 | 2 / 0 / 39 / 2 | 1.000 | 0.500 | 0.667 |
| Hate | 4 / 39 | 0 / 0 / 39 / 4 | n/a | 0.000 | 0.000 |
| Threats | 3 / 40 | 3 / 0 / 40 / 0 | 1.000 | 1.000 | 1.000 |
| Spam | 2 / 41 | 2 / 0 / 41 / 0 | 1.000 | 1.000 | 1.000 |

### Frozen V4 test (36 items; scored once after changes)

| Category | Pos / Neg | TP / FP / TN / FN | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Harassment | 4 / 32 | 3 / 0 / 32 / 1 | 1.000 | 0.750 | 0.857 |
| Hate | 4 / 32 | 0 / 0 / 32 / 4 | n/a | 0.000 | 0.000 |
| Threats | 1 / 35 | 1 / 0 / 35 / 0 | 1.000 | 1.000 | 1.000 |
| Spam | 2 / 34 | 2 / 0 / 34 / 0 | 1.000 | 1.000 | 1.000 |

### Per-language raw counts

Each cell is `n: TP/FP/TN/FN`. Some language/category slices have no positives; a high TN count in such a slice does not establish recall.

| Split | Language | Harassment | Hate | Threats | Spam |
| --- | --- | --- | --- | --- | --- |
| Dev | Arabic | 6: 1/0/5/0 | 6: 0/0/5/1 | 6: 0/0/6/0 | 6: 0/0/6/0 |
| Dev | English | 17: 0/0/16/1 | 17: 0/0/16/1 | 17: 3/0/14/0 | 17: 0/0/17/0 |
| Dev | Mixed | 6: 0/0/5/1 | 6: 0/0/5/1 | 6: 0/0/6/0 | 6: 0/0/6/0 |
| Dev | Arabizi | 14: 1/0/13/0 | 14: 0/0/13/1 | 14: 0/0/14/0 | 14: 2/0/12/0 |
| Test | Arabic | 6: 1/0/5/0 | 6: 0/0/5/1 | 6: 0/0/6/0 | 6: 0/0/6/0 |
| Test | English | 12: 0/0/11/1 | 12: 0/0/11/1 | 12: 1/0/11/0 | 12: 0/0/12/0 |
| Test | Mixed | 6: 1/0/5/0 | 6: 0/0/5/1 | 6: 0/0/6/0 | 6: 0/0/6/0 |
| Test | Arabizi | 12: 1/0/11/0 | 12: 0/0/11/1 | 12: 0/0/12/0 | 12: 2/0/10/0 |

## Error inventory and priorities

- **Hate (P0):** all four positives in each V4 split are missed. Exact mechanism: the only `hate` expression in `policy.ts` matches `all/every [members of] group are vermin/subhuman`; none uses the literal placeholder `group`. No normalization, precedence, or category-conflict cause. Rules can address explicit group-target predicates, but identity-target vocabulary and cross-script variants need independent annotation and a broader set of matched negatives first.
- **Harassment:** two V4 dev positives miss (`clueless fraud`, `You are أهبل...`) and one test positive misses (`absolute joke of a coworker`). The current patterns enumerate selected insults and phrases; these are missing constructions/lexical coverage. No broad adjective list is justified by these samples alone. Product criticism remains visible.
- **Threats:** the original dev FN is the exact English `I'll break your jaw`; the narrow future body-part pattern fixes it. Remaining limitations include alternate syntax, body parts outside the curated list, indirect speech without explicit reporting cues, joking/irony, and embedded fictional contexts. The narrowly observed joke cue does not solve general stance attribution.
- **Spam:** the V3 miss required `enta kasabt` rather than `mabrook/mabrouk kasabt`. The exact expansion detects the V4 set with matched benign controls; uncommon Arabizi spelling, gender variants, and requests lacking explicit claim terms remain untested.
- **False positives:** none on final V4 dev or test for harassment/hate/spam/threats. The attempted threat rule initially falsely matched a joking quotation in V4 test; the V4 development-supported explicit report/joke cue removed this one observed error. This demonstrates why challenge-set negatives matter, but does not estimate production FP rate.

## Generalization, limitations, and exit gate

V4 demonstrates additional deterministic gains for the specific body-part threat and `enta kasabt` spam constructions. One new synthetic frozen set is not enough to claim broad generalization or rule-engine plateau. V2 and V3 challenge sets remain frozen historic cycles, and their different composition prevents clean cross-cycle gain estimates. V4 remains single-author, small, synthetic, and drawn with knowledge of candidate gaps; no independent adjudication or prevalence sampling occurred.

More deterministic improvements remain justified for explicit, narrowly defined constructions when independently annotated positive and negative data exist. Hate needs an operational implementation inventory of identity targets and explicit attack grammars, but any new lexicon should be reviewed by multiple annotators and paired with same-target policy/mention/counterspeech negatives. More semantic context is needed for implicit group animus, sarcasm, speaker endorsement, repeated harassment across turns, and ambiguous identity references. Rules cannot reliably infer those from isolated comments.

No plateau is established. Exit criteria: collect substantially larger consent-safe data; obtain independent blinded annotation and adjudication; keep genuinely untouched test cycles with no paraphrase/template leakage; report confidence intervals and category/language supports; set a predeclared FP budget and minimum recall per category; and require at least two successive independent cycles with negligible held-out gains and no material regressions before claiming diminishing deterministic returns.
