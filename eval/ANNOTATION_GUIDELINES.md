# Rule-engine evaluation annotation guidelines

## Provenance and intended use

The `rule-engine-v2-*` files are synthetic, hand-authored challenge sets created for this repository. They contain no scraped, private, or real-user comments. They test known policy boundaries and implementation classes; they are not representative samples of social-media prevalence. Dataset authors know the current rule patterns, so these labels cannot replace independent human annotation.

`rule-engine-v2-dev.json` and `rule-engine-v3-dev.json` may guide rule changes. `rule-engine-v2-test.json` and `rule-engine-v3-test.json` are separate frozen challenge splits; evaluate them only after rules and development decisions are frozen, and never use their errors to choose or revise patterns. The prior `rule-engine-heldout.json` has already been inspected and used during tuning; treat it as a historical validation set, not an untouched test set. V3 examples were separately drafted but share one synthetic author; future release-gate sets need independent annotators and adjudication.

Every example stores a stable ID, exact text, one primary category under review, expected multi-label category set, language/script stratum, clear status, rationale, provenance, and annotation version. Avoid splitting variants of the same template, phrase, or paraphrase across dev and test. The split-integrity test checks canonical exact duplicates and token-shingle similarity; manually inspect borderline pairs as well.

## Operational category policy

- **Harassment:** abuse directed at an identifiable individual or conversational participant, including personal insults, humiliation, bullying, and repeated unwanted targeting. A criticism of the person's claim, code, product, or conduct is not harassment by itself. Context-dependent sarcasm, banter, or quoted abuse is ambiguous unless the text clearly adopts the attack.
- **Hate:** demeaning, exclusionary, or threatening abuse directed at people because of a protected or otherwise policy-designated identity (for example, religion, ethnicity, race, disability, sex, or sexual orientation). The target must be people as an identity group. Criticism of a religion's doctrine, an ideology, an institution, or a policy is not hate by itself. Targeting one person with a slur is harassment unless the attack is group-directed as well.
- **Threats:** a direct or credible expression of intent to cause physical harm to a person, or encouragement of self-harm. Idioms (“kill time”), negated intent, fictional/reporting/quoted text, and discussion of threats are negatives unless the author endorses the threat.
- **Spam:** unsolicited repetitive solicitation, scam/prize/profit bait, or link flooding. A single link, legitimate promotion, ordinary request to message someone, or discussion of a prize is not spam by itself.

Multiple labels are allowed only when each category's definition is independently met. Do not use `hate` as a synonym for a severe personal insult. The current UI category `hate` is retained; policy definition does not assert legal classification.

## Label procedure

1. Read the full example and its supplied context, if any. Do not infer missing context or speaker intent.
2. Choose `clear` only when the text itself supports the category decision under the policy above. Use `ambiguous` when reasonable readings differ and the context needed to resolve them is absent.
3. Assign the expected category set. For clear hard negatives it is empty. `primaryCategory` identifies which distinction the case probes; it is not necessarily a positive label.
4. Add a short rationale tied to the text and policy. Avoid rationales that merely restate the label.
5. Track provenance and annotation version. Any future externally sourced examples require source, license/permission, privacy review, and independent annotator adjudication before entering a scored set.

## Metrics

Report one-vs-rest TP, FP, TN, FN, precision, recall, F1, and sample support by category and language stratum. Use only clear examples for those metrics; report ambiguous count and predicted coverage separately. If no positive or predicted instances exist, show the corresponding metric as undefined (`n/a`), never as perfect. Show denominators with each result. Keep category and language slices with no positive labels visible so missing coverage cannot be mistaken for success.

## V4 extension: annotation and split protocol

V4 keeps the policy above: hate requires an attack on people targeted as an identity group, and a negative view of a policy, institution, doctrine, or a mere identity mention is not hate. Harassment remains personal targeting; threats require stated or endorsed physical harm; spam requires unsolicited solicitation or flooding, and is never relabeled as harassment or threats merely because it is unwanted.

The V4 files contain 43 development examples and 36 frozen-test examples. The task author drafted the two splits separately before editing rules, added a rationale and provenance per item, and checked all examples against the category policy. No second human reviewer or adjudicator was available. Thus “separately drafted” describes split construction only; it is not independent annotation. All items are synthetic, not scraped, not user-submitted, and not prevalence samples. No ambiguous examples were included; this does not imply that real cases are unambiguous. For deployment evaluation, require two independent annotators, blinded to predictions and split membership, plus adjudication for disagreement.

V4 integrity tests require unique IDs, complete labels/rationales/provenance, and no exact canonical or token-bigram Jaccard similarity >=0.80 between V4 test and V4 development or any earlier corpus, including V2/V3. This is an automated screen, not a guarantee against all semantic leakage; manually review paraphrase/template overlap when data are independently collected. V2/V3 dataset files remain unchanged and are never used to choose V4 rules.

New challenge items extend support for English threats to body parts and Egyptian Arabizi prize solicitation. The hate examples probe English, Arabic, mixed text, and Arabizi positive patterns alongside policy criticism, neutral mention, and counterspeech controls. They are sufficient to expose the placeholder's coverage gap but too few and too author-aware to establish broad category coverage or justify a general identity lexicon.

## Independent review protocol for future scored sets

Use at least two human reviewers who are fluent in the item's language/script (Egyptian Arabic/Arabizi for those strata) and trained on the operational policy. Give each reviewer the text and only necessary neutral context; hide model predictions, prior annotations, and whether an item belongs to development or test. Reviewers independently assign a multi-label set, clear/ambiguous status, category-specific rationale, confidence, and dialect/script tags. Keep a third adjudicator blinded to predictions and split; adjudicate every disagreement, retain both original labels and the adjudicated label, and record a short rationale for the decision. If reviewers cannot resolve context or policy ambiguity, preserve `ambiguous` and exclude it from binary metrics while reporting its count and prediction coverage. Preserve author/source, collection date, consent/license/privacy review, reviewer IDs under appropriate access controls, and annotation-policy version. Split by source/thread/template before annotation unblinding; freeze test labels and access before any rule tuning. The current V5 task had no independent reviewers or suitable consented corpus; its synthetic labels are not independent evidence.
