# Tathabbut Architecture Decision Record — October 2026

**Status:** Provisional research decision; not a production architecture approval  
**Review date:** 2026-10-18  
**Audit baseline:** `feat/text-filter-engine` at `bc1823d367100bf8e69e4282f7b1b5bfecf8d1c6`  
**Scope:** Synthesized findings from the submitted agent reports and their attached research artifacts. This document records decisions and evidence boundaries; it does not claim that proposed stages have been implemented.

## Executive decision

Pursue a **local-first, staged classifier**, but make DOM lifecycle correctness and evaluation integrity prerequisites for model selection. Keep the deterministic rules as the current always-available baseline. Treat TF-IDF + word/character n-grams + logistic regression as the first learned candidate to evaluate—not as an approved shipped classifier. Keep a neural model and remote inference gated behind independent evidence.

## Decision register

| ID | Decision / direction | Evidence status | Consequence |
| --- | --- | --- | --- |
| ADR-01 | Fix and validate hide/reveal DOM lifecycle before optimizing classification. | User-reported duplicate/repeated notices; static audit found lifecycle risks; exact live root cause has not yet been reproduced independently. | Require tests for one control per target, correct target ownership, reversible reveal, mutation churn, and stale decisions. |
| ADR-02 | Retain deterministic rules as a fallback and for clear lexical patterns. Do not treat fixed scores such as 0.86/0.90 as calibrated probabilities. | Current code inspection; fixed rule scores are heuristic constants. | Keep policy labels and confidence/calibration concepts distinct. |
| ADR-03 | Evaluate a small classical model before a transformer. | Submitted Python experiments report strong in-distribution results but lower scores on other datasets; they are not browser measurements. | Compare rules and TF-IDF/LR on the same locked evaluation set and the extension's actual train/serve preprocessing. |
| ADR-04 | Do not select a neural model based on latency alone. | e5-small int8 was timed using native ONNX Runtime on a 2-vCPU container; classifier quality and Chrome runtime remain unmeasured. | Require a task-appropriate classification head and measurable incremental benefit in a browser benchmark. |
| ADR-05 | Default to local processing. Any remote escalation must be explicit, opt-in, provider-specific, budget-capped, and safely fall back locally. | Architectural/privacy review; no evidence that a remote service is necessary. | No required API dependency or developer-funded free-tier assumption. |
| ADR-06 | Unknown or borderline content should not be automatically hidden merely because a model is uncertain. | Cross-report design recommendation; threshold calibration not yet available. | Evaluate conservative visible/abstain behavior and false-hide costs separately. |
| ADR-07 | Build an evaluation set with independent authorship, reviewed labels, source provenance, and leakage-resistant splits. | Repeated limitation across reports; current wild proxy is hand-authored and small. | Report metrics per category and hard-negative family, not just aggregate F1. |
| ADR-08 | Ensure training and inference use equivalent normalization and feature extraction. | The submitted experiment reports a raw-text Python vectorizer while the extension normalizes text; JavaScript/scikit-learn feature parity is not demonstrated. | No Python score is accepted as the shipped implementation's score until parity is measured. |

## What the experiments do and do not establish

### Reported measurements

- Rules-only backend mirror: approximately 0.03 ms/item; reported recall on the supplied Egyptian test split was 0.99%. This is a result for the tested backend mirror and its label mapping, **not** a definitive measurement of the browser extension's current rules.
- TF-IDF + Logistic Regression: approximately 0.61 ms/item in the Python/container experiment and about 1.3 MB reported model size. Reported binary F1 was about 0.95 on the Egyptian in-distribution split, about 0.68 on OSACT4 dev, about 0.52 on MPOLD holdout, and about 0.53–0.64 on the hand-authored adversarial set depending on model configuration.
- multilingual-e5-small int8: about 2.9 ms for short text and 18 ms at 128 tokens, measured with native ONNX Runtime on a 2-vCPU container; model artifact about 118 MB and peak RSS delta about 201 MB. These are not Chrome WASM/WebGPU measurements, and the encoder alone is not a Tathabbut classifier.
- A simple rules-OR-ML simulation reported F1 about 0.667 on the 123-item adversarial proxy, versus about 0.531 for ML alone and 0.468 for rules alone. It also reported more false positives (9 versus 5 for either single component). Treat it as a small-set simulation, not a deployment result.

### Important qualifications

1. The backend rules experiment is not the same as running `extension/src/policy.ts` in Chrome; normalization and pattern inventories may differ.
2. Dataset labels such as offensive, hate, threat, spam, and harmful are not interchangeable. Training coverage for threats and spam was absent or inadequate in the reported classical setups.
3. The adversarial set is hand-authored, small, and not fully independent of the ideas/rules being examined.
4. The reported cross-dataset results are not all equivalent forms of domain transfer: for example, OSACT4 dev follows OSACT4 training, while MPOLD uses an internal held-out split.
5. Raw logistic-regression confidence is not yet demonstrated to be calibrated for routing.
6. The cascade simulation's reported escalation bounds require a careful confusion-matrix audit before being used to claim an accuracy gain.
7. Static DOM inspection can identify risks but cannot independently reproduce the user's live Facebook behavior.

## Work priorities

1. **P0 — DOM lifecycle:** diagnose repeated hide/reveal UI, target ownership, reversible reveal, and behavior under page mutations and virtualized/recycled nodes.
2. **P1 — Baseline parity:** align the extension/backend normalization and document any intentional differences; prevent classification of controls/metadata where extraction can do so safely.
3. **P2 — Evaluation quality:** create an independently authored Egyptian Arabic/Arabizi hard-negative evaluation set with provenance, adjudication, and source/thread separation.
4. **P3 — Classical ML comparison:** compare the same rules, word/character TF-IDF + LR, and other lightweight candidates on the same locked data, including benign false-positive families and calibration.
5. **P4 — Browser performance:** measure end-to-end insertion-to-verdict/hide latency, renderer/main-thread work, queue depth, memory, and offline behavior in Chromium.
6. **P5 — Optional semantic model:** test only if P3 exposes a specific gap that justifies model download and runtime cost.
7. **P6 — Remote inference:** remain optional and out of the critical path; implement only if user need and privacy/cost constraints justify it.

## Exit conditions before model selection

- The duplicate-notice/reveal issue has a targeted regression test and the relevant extension suite passes.
- The selected DOM target is correct, each target owns at most one notice/reveal control, and reveal restores the target without deleting content.
- Rules and a candidate learned model are compared on the same held-out evaluation data; results include per-category precision/recall/F1 and false positives on criticism, quotation, counterspeech, sarcasm/teasing, and benign dialect.
- Training/serving feature parity has been demonstrated or the results are explicitly limited to the Python prototype.
- A neural stage, if considered, beats the strongest classical baseline by a pre-agreed margin on the independent set and meets browser resource budgets.

Thresholds such as 5% false-positive rates or a five-point F1 improvement are **candidate acceptance targets**, not achievements. They must be justified and fixed before final evaluation to avoid tuning to the test set.

## Scope and safety

This is a decision record, not authorization to ship the proposed cascade. No model stage described here should be assumed to exist in the production extension unless its code, packaging, tests, and runtime behavior have been verified. Keep changes on the dedicated work branch and do not merge to `main` without review.
