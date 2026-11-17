# Rule engine V7 evaluation methodology

## Annotation policy

Items represent the authoring speaker's text, not the quoted speaker's intent. Annotate the text as written and do not infer a target, identity, intent, or context that is absent. `ALLOW` means no category signal; `HIDE` means at least one high-specificity local rule meets the existing user threshold; `REVIEW` means a category signal exists but the rule is contextual or below threshold. `REVIEW` remains visible.

- **Harassment:** targeted personal abuse, humiliation, bullying, or degrading language toward an identifiable person. Criticism of code, products, ideas, arguments, explanations, and institutions is not personal harassment. Generic sarcasm without an explicit addressee is ambiguous and should not auto-hide.
- **Hate:** an attack, dehumanization, or exclusion directed at people because of a protected or policy-designated identity. Identity terms, neutral descriptions, counterspeech, policy criticism, and discussion or quotation of hateful language are not hate. The current literal `group` placeholder is not valid identity evidence and can only signal review.
- **Threats:** expressed intent or imperative to cause physical harm, including narrowly recognized self-harm encouragement. Negated, quoted, reported, joking, fictional, and ordinary technical/literal uses are hard negatives unless the author's own intent is clear.
- **Spam:** unsolicited deceptive solicitation, high-volume/repeated-link abuse, or a prize/reward lure coupled with private contact and a claim/collection action. Legitimate promotions, reports of prizes, and benign requests to contact privately are hard negatives.

Multi-label only when each category independently meets its definition. Category detection and the operational action are evaluated separately. Ambiguous items retain a rationale but are excluded from binary precision/recall/F1; their review/allow behavior is reported separately.

## Review and provenance

The V7 dev and test examples are synthetic challenge examples written by one project contributor. No independent annotators, blinding, adjudication, consented real-world sampling, or external corpus were available. Consequently, labels are provisional author labels, not independent evidence. An actual independent protocol requires two fluent reviewers blinded to predictions and split, with a third reviewer adjudicating disagreements; preserve both initial labels and rationales, then freeze splits before tuning.

Each record stores a stable ID, text, language/dialect, category labels, expected operational action, status, context type, targeting evidence, and rationale. After the first score, policy review found three examples (two isolated mockery signals and one literal `group` placeholder) were marked clear despite rationales saying target/identity was unresolved. Their text and split membership remain fixed, but their expected category labels/status were corrected to ambiguous; this single-author correction is recorded in each JSON file. As one corrected example is in the held-out split, V7 held-out results are exploratory and no longer an untouched labeled test. The evaluator checks unique IDs and cross-split near duplicates using normalized token trigram Jaccard >= 0.8. This catches close lexical reuse, not paraphrase leakage or shared author/style. It is not a substitute for provenance-based grouping or human review.

## Split discipline and limits

`rule-engine-v7-dev.json` was created for this development cycle. `rule-engine-v7-test.json` was authored and frozen before rule implementation and is used only to report results; its outcomes do not assert passing behavior and must not guide changes. V2-V6 frozen assets remain unchanged. V7 does not claim independence from all prior synthetic corpora, real Facebook comments, or production distributions. Repeated examples from a single author and tiny category/language support invalidate population accuracy claims.

The V7 evaluator prints per-category TP/FP/TN/FN, precision, recall, F1 and per-language raw counts. `n/a` means no denominator support. It also reports expected-action mismatches (including REVIEW) independently. These are descriptive challenge-set results; no confidence interval or real-world estimate is claimed.
