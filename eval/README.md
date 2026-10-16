# Evaluation dataset

Versioned synthetic starter set: `dataset.json` (version `0.1.0`).

## Purpose

Measure what the current deterministic starter rules actually do — especially
false positives — before claiming any language support or accuracy.

## Annotation rules

- A **positive** (`expect` non-empty) must contain an explicit, narrow,
  directly abusive or spammy statement with no mitigating context.
- A **strict negative** (`expect: []`, `strict: true`) must be hidden by no
  rule: respectful disagreement, criticism of ideas/policies, uncertainty,
  counterspeech, benign mentions, idioms, or single links.
- A **known-limitation** item (`strict: false`) documents a case the current
  rules handle poorly (quotation, educational mention). These are measured
  and reported but do not fail the guardrail test.
- Egyptian-dialect items are tagged in their `note`.
- `/u` regex items assume the same normalization as `policy.ts`
  (NFKC, diacritics removed, alef variants unified, extra whitespace collapsed).

## Metrics

For each category the evaluation reports TP, FP, TN, FN, precision, recall,
F1, and false-positive rate, plus sample sizes. Run:

- Extension: `cd extension && npm test` (the `eval.test.ts` suite prints the table).
- Backend parity: `cd backend && pytest` (strict items must match on both sides).

## Limitations (read before citing numbers)

- Synthetic, tiny (~30 items), written by the project — not real feed data.
- No consent-sensitive or real-user content included.
- Cannot establish real-world accuracy, dialect coverage, or robustness to
  obfuscation, transliteration, sarcasm, or reclaimed language.
- Quotation/educational mentions are known false-positive risks.
- Arabic coverage is a few explicit starter patterns only.
