# V10 rule-engine cycle: spam co-occurrence with expanded private-contact cues

## Scope and evidence

V1–V9 frozen assets were not edited. V10 has 14 synthetic development examples (11 clear, 3 ambiguous) and 10 synthetic held-out examples (8 clear, 2 ambiguous), authored by one contributor before implementation; see [`RULE_ENGINE_V10_PLAN.md`](RULE_ENGINE_V10_PLAN.md), [`rule-engine-v10-dev.json`](rule-engine-v10-dev.json), and [`rule-engine-v10-test.json`](rule-engine-v10-test.json). No independent reviewers, adjudication, external sampling, or production comments; outcomes are exploratory single-author evidence. Unique-ID and trigram split-leakage checks passed after correcting one accidentally duplicated text between splits (text changed before any post-change scoring).

**Disclosed label correction (before post-change scoring):** two "congratulate only" items contained the literal prize phrase that already triggers contextual `spam.3`. They were authored as clear `ALLOW` but the pre-change baseline showed `REVIEW`; their labels/status were corrected to **ambiguous / REVIEW** in both splits before the rule was implemented. Texts and split membership are unchanged. This is a single-author correction, not independent adjudication.

The cycle targets one gap: the existing co-occurrence rule (`spam.4`) requires *reward opener + private contact + claim/collection*, but its private-contact vocabulary covers only `ابعتلي خاص/رسالة خاصة` and `dm me privately`. Bait using `dm me in private`, `message me privately`, `كلمني على الخاص`, `راسلني على الخاص`, or `بعتلي على الخاص` remained at REVIEW despite the full triad.

## Pre-change baseline (recorded before implementation)

After the label correction: development spam `TP=1 FP=0 TN=6 FN=4`, held-out spam `TP=1 FP=0 TN=4 FN=3`. The single "TP" in each split came from a contextual `spam.3` match whose **action** was REVIEW (an operational miss): label-level detection and action-level hiding are reported separately below. All protected negatives were already visible; zero false positives was the acceptance constraint.

## Prioritized findings and code traces

1. **One appended co-occurrence pattern (`spam.6`).** The reward lookahead is identical to `spam.4`; only the private-contact lookahead is expanded with the five attested variants above. `claim`/`collect` are **word-bounded** so past-tense `collected` cannot satisfy the claim element. No pattern was inserted before existing ones; `spam.1`/`spam.3` remain contextual and `spam.4`/`spam.5` are unchanged.
2. **Normalization interaction discovered during dev scoring.** `normalizeForRules` maps the Arabic alef maqsura `ى → ي`, so written `على` becomes `علي` inside rule matching. The first implementation used `على` and missed all three Arabic positives; the corrected cue uses `عل[ىي]`. This is a rule-text bug, not an annotation change, and is locked by regression tests.
3. **Two-of-three cases stay visible.** Logistics requests, past prize reports, reward + private contact with no claim, and reward + collection with no private contact all remain ALLOW; prize-only congratulations remain contextual REVIEW via `spam.3`.

No changes to thresholds, categories, DOM, hiding, or provider contract.

## Before/after category metrics

Counts use `TP/FP/TN/FN` for category labels; ambiguous items are excluded. Values are descriptive; small support makes perfect scores uninformative. Spam is the only category with V10 positive support; harassment, hate, and threats have zero positives and zero false positives.

| Split | Category | n clear | Before TP/FP/TN/FN | Before P/R/F1 | After TP/FP/TN/FN | After P/R/F1 |
| --- | --- | ---: | --- | --- | --- | --- |
| V10 development | Spam | 11 | 1/0/6/4 | 1.000/0.200/0.333 | 5/0/6/0 | 1.000/1.000/1.000 |
| V10 development | Others | 11 | 0/0/11/0 | n/a/n/a/n/a | 0/0/11/0 | n/a/n/a/n/a |
| V10 held-out | Spam | 8 | 1/0/4/3 | 1.000/0.250/0.400 | 4/0/4/0 | 1.000/1.000/1.000 |
| V10 held-out | Others | 8 | 0/0/8/0 | n/a/n/a/n/a | 0/0/8/0 | n/a/n/a/n/a |

Per-language after the change (`TP/FP/TN/FN`): development English `n=8`: spam `3/0/5/0`; development Arabic `n=3`: `2/0/1/0`; held-out English `n=7`: `3/0/4/0`; held-out Arabic `n=1`: `1/0/0/0`. Mixed and Arabizi support are zero in V10.

Operational action matrix (expected rows, actual columns) on clear items:

| Split | ALLOW row: ALLOW/HIDE/REVIEW | HIDE row: ALLOW/HIDE/REVIEW | REVIEW row |
| --- | --- | --- | --- |
| V10 development, n=11 | 6/0/0 | 0/5/0 | empty |
| V10 held-out, n=8 | 4/0/0 | 0/4/0 | empty |

The prior "TP" from `spam.3` is correctly reflected as an operational miss in the pre-change action matrix; after V10 it becomes a high-specificity HIDE through `spam.6`.

Frozen V7, V8, and V9 splits produced no action changes under the new rule.

## Documented residual false-positive risk

Three ambiguous "legitimate raffle" items — `v10d-en-raffle-committee`, `v10d-ar-school-certificate`, `v10t-en-ambiguous-committee` — contain the full triad plus a committee/school attribution; the engine now auto-hides them (`expected=REVIEW, actual=HIDE`, excluded from metrics). This is the same deferred risk class as V8's benign `clown` frame and V9's banter threats. It was not tuned away: doing so would require an exception list that could suppress genuine prize bait.

## Error analysis and next work

- **Fixed:** four development and three held-out high-confidence triad cases reached auto-hide (five and four by label), with zero new false positives on V1–V9 splits or the 59-item classification corpus.
- **Still unsupported (recorded, not tuned):** generic promotion without a triad, link-count spam with few links, trustworthy-legitimacy discrimination for committee raffles, typo variants in spam openers, and any reward-only auto-hide (deliberately excluded). Remaining roadmap cycles: V11 bounded typo/repeated-character normalization, V12 Arabizi variation, and semantic rule IDs (technical). Hate remains blocked on policy, an identity taxonomy, and independently reviewed data (P0).
- **No plateau claim:** three consecutive cycles show non-negligible held-out gains (V8 third-person abuse, V9 injury threats, V10 spam triads); the 2–3-cycle "negligible gain" exit gate is not met.

## Exit gate

Unchanged from V7–V9: no model comparison before independently annotated, consent-safe examples with two blinded reviewers, adjudication, a frozen split authored before tuning, per-category/per-language metrics with support, and demonstrated low false-positive harm on criticism, counterspeech, reporting, and legitimate promotion.

## Validation

The extension suite passed (22 files, 456 tests, including the V10 eval harness and 15 new policy regressions); TypeScript compilation and production build passed; `verify-dist` passed within the build; backend pytest passed (33 tests); frozen V7/V8/V9 harnesses report no action errors; and the pre-change baseline commit (`7303cbf`) plus all frozen V1–V9 assets underpin this cycle.
