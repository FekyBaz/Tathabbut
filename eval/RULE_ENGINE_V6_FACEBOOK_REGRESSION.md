# V6 Egyptian Arabic and Facebook regression cycle

## Scope and provenance

This cycle uses `rule-engine-v6-ar-dev.json`, 26 items total: 24 clear and 2 ambiguous. Three clear examples (`غبي`, `فاشل`, `يا علق`) are the user's exact Facebook observations and interpreted as direct comment-level insults under the existing policy. The remaining clear items are synthetic contrastive cases. No independent fluent reviewer or adjudicator was available; labels are task-author interpretations, and the user observations are a small convenience sample, not population data. No frozen V2, V3, V4, or V5 evaluation files were changed. No new V6 test split was created or scored.

The two unresolved examples are `الفشل بنفسه` (no explicit target; can be rhetorical/metaphorical) and `فاشل ادج` (unclear spelling and target). Both remain ambiguous and are excluded from metrics. They are not treated as failures or successes.

## Classification audit

- Exact standalone `غبي` and `فاشل` already match the existing whole-message harassment pattern. Their live misses are not caused by missing words in the current local policy. A missed live result for those exact strings would instead require checking the actual text reaching classification, enabled categories/threshold, or whether Brave loaded the current `dist`; this code-only task cannot establish which occurred on Facebook.
- `يا علق` and explicit `انت علق` were absent from the current patterns. Added only these direct address constructions in the categorized `egyptian-arabic-abuse.ts` lexicon.
- `الفشل بنفسه` and `فاشل ادج` were not generalized into rules because targeting/spelling is unclear from the text alone.
- Existing NFKC, diacritic/tatweel removal, alef normalization, invisible-control removal, and whitespace normalization already support the tested `إنت/انت`, diacritic, punctuation, and spacing cases. No repeated-letter collapse or fuzzy matching was added. Arabizi remained limited to previously supported exact forms; no `3ala2` transliteration was invented.
- Direct profanity remains harassment only where the existing rules identify personal targeting (including vocative/second-person constructions or selected whole-message insults). Product/code/argument criticism, neutral mention, reported use, and prohibitive mention remain visible. `hate`, `threats`, and `spam` were not modified.

## V6 development measurements

Only clear cases are scored. Counts are TP/FP/TN/FN for harassment. The 24 clear cases contain 9 positive and 15 negative examples; 2 ambiguous examples are excluded.

| Slice | n | Before TP/FP/TN/FN | After TP/FP/TN/FN | Before P/R/F1 | After P/R/F1 |
| --- | ---: | --- | --- | --- | --- |
| All clear | 24 | 7/0/15/2 | 9/0/15/0 | 1.000/0.778/0.875 | 1.000/1.000/1.000 |
| Arabic script | 16 | 4/0/10/2 | 6/0/10/0 | 1.000/0.667/0.800 | 1.000/1.000/1.000 |
| Mixed Arabic-English | 4 | 2/0/2/0 | 2/0/2/0 | 1.000/1.000/1.000 | 1.000/1.000/1.000 |
| Arabizi | 4 | 1/0/3/0 | 1/0/3/0 | 1.000/1.000/1.000 | 1.000/1.000/1.000 |
| English | 0 | n/a | n/a | n/a | n/a |

The two newly covered Arabic-script positives are `يا علق` and `انت علق`. Existing hits on standalone `غبي`, `فاشل`, and the mixed/Arabizi controls are not new gains. All 15 clear negatives remained unclassified as harassment. Zero false positives in a tiny synthetic set is not a production precision estimate. Hate, threats, and spam have no positive support in this cycle and are unmeasured (`n/a`), not perfect.

## Duplicate notice investigation and fix

Candidate discovery deduplicates identical DOM element references with `Set`, removes nested comment units from text extraction, and aggregates each mutation batch's affected elements with another `Set`. Hide presentation is inserted in `applyResult`, while reveal removes direct controls and wraps/unhides the exact target. Same-target hide application previously trusted only the `data-tathabbut-hidden` attribute as its idempotency marker. A DOM regression reproduces duplicate insertion if that marker is removed while the notice and reveal button remain: `applyResult` then inserted another pair. The fix reuses a complete direct control pair and removes any extra direct pairs; an incomplete stale pair is cleaned up and recreated. Separate comment/reply targets retain separate controls, and existing reveal behavior remains in place.

This is a reproduced code-level marker-loss failure and its fix. It does not prove the exact Facebook re-render that produced the user's live symptom; no live Facebook DOM or Brave session was available for inspection. Duplicate nodes representing one logical Facebook comment may still need a sanitized DOM sample if the same symptom persists after loading this build. Regression tests verify one notice/button after marker loss and duplicate controls, independent comments, manual reveal, no immediate re-hide after an unrelated sibling insertion, and code/product criticism controls.

## Limitations and manual live regression plan

This cycle adds a small high-confidence lexicon entry, not an exhaustive list of Arabic insults or profanity. It does not determine whether an isolated insult targets a person from surrounding conversation. The 24 clear challenge items and user-provided observations cannot establish real-world accuracy, dialect coverage, or a rule-engine plateau. No live Facebook validation is claimed.

After rebuilding `extension/dist`, manually test on Facebook:

1. Confirm one notice and one reveal control for comments `غبي`, `فاشل`, `يا علق`, and `انت علق`.
2. Keep `الكود فاشل ومحتاج إعادة كتابة`, `الشرح ضعيف ومش واضح`, and the listed respectful disagreement/source requests visible.
3. Keep a quoted/reported `يا علق` and `متقولش لحد يا علق` visible.
4. Check Arabizi `enta faker` behavior with product/argument criticism as controls; do not infer coverage for unreviewed spellings.
5. Reveal an insult, trigger an unrelated feed update, and confirm it stays revealed; separately verify text/policy changes can be reconsidered as designed.
6. Inspect any repeated controls by enabling local diagnostics, checking candidate source/fingerprints and the number of hidden targets, then capture a sanitized DOM structure without names, post text, or URLs. Confirm only one Tathabbut extension instance is enabled in Brave.

## Files changed in this task

- `extension/src/egyptian-arabic-abuse.ts`: categorized direct-target forms.
- `extension/src/policy.ts`: imports the new patterns and suppresses the explicitly prohibitive `متقولش لحد يا علق` mention.
- `extension/src/policy.test.ts`: direct, negated, quoted, criticism, and normalization regressions.
- `extension/src/content.ts`: idempotent reuse/deduplication of direct hide controls after marker loss.
- `extension/src/content.test.ts`: Facebook-like comment extraction, independent controls, reveal, and duplicate-control regression tests.
- `eval/rule-engine-v6-ar-dev.json` and `extension/src/rule-engine-v6-eval.test.ts`: development labels and before/after metrics.
