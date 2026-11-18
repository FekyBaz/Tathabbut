# V8 rule-engine cycle plan: third-person authored abuse

> Written **before implementation**, following the same discipline as
> [`RULE_ENGINE_V7_METHODOLOGY.md`](RULE_ENGINE_V7_METHODOLOGY.md) and the committed
> roadmap (`docs/ROADMAP.md`, Phase 1). Dev examples exist before any code change.

## Scope (one gap only)

Third-person **authored** personal abuse:

- English: `he's / he is / she's / she is + personal insult` (same attested
  insult vocabulary and intensifiers as the covered second-person pattern).
- Egyptian Arabic: `هو / هي + personal insult` (same reviewed vocabulary as the
  covered second-person list), including the waw-conjoined form `وهو / وهي`.

Out of scope (documented, not implemented this cycle): third-person plural
(`they're`), past tense (`he was`), Arabizi third person (`howa fashel`),
Arabic-clitic pronouns (`فهو`), and second-person "the idiot" forms. These are
recorded as residual gaps for later cycles.

## Documented evidence (dev failure)

- Held-out miss recorded in the V7 cycle report: `v7t-en-report-then-attack`
  ("Then I told him he's pathetic." — authored insult after a first-person lead
  is preserved, but no third-person pattern exists to match it).
- Structural asymmetry: every direct-abuse rule requires second-person or
  vocative targets, so third-person degradation is systematically missed.

## Protected hard negatives (required to pass)

1. **Object/work criticism:** "His code is pathetic." / "الكود اللي كتبه فاشل."
2. **Idea criticism:** "The design he's proposing is stupid." (insult must
   follow the pronoun directly; here a verb intervenes).
3. **Possessive subjects:** "Her design is a joke."
4. **Attributed opinions:** "She thinks he's an idiot." / "He believes she's a
   moron." — requires one narrow addition to `REPORTING_CUE`: a separate
   alternative for third-person cognition verbs
   (`he|she|they + thinks/believes/claims`). First-person cognition ("I think
   you're an idiot") must remain authored and hideable.
5. **Negation:** "هو مش غبي" (adjacency broken by negation → no match).
6. **Factual third-person descriptions:** "He is the manager and she is the
   engineer."
7. **Praise + object criticism in one sentence:** "هي متحمسة بس المشروع فاشل."

## Implementation sketch (narrow, appended)

- Two harassment patterns **appended** at the end of the array to preserve
  position-derived rule IDs (`harassment.23` English, `harassment.24` Arabic,
  exact indices verified after edit). Both are **high specificity** (not added
  to `CONTEXTUAL_RULE_IDS`): explicit grammatical target exists.
- English pattern mirrors the second-person intensifier/insult vocabulary
  exactly; no new insult tokens are introduced this cycle.
- Arabic pattern mirrors the reviewed Egyptian second-person insult vocabulary,
  with optional waw conjunction and the existing alef/ya normalization.
- One narrow `REPORTING_CUE` addition for third-person cognition attribution.

## Acceptance criteria

1. All V8 dev clear items pass (positives + hard negatives).
2. V8 held-out evaluated **once**, after freezing, with no tuning on it.
3. No regression: V1–V7 frozen datasets, `classification-corpus`, and the 399
   existing tests stay green.
4. Known FP risk documented: "He's a clown at parties" is ambiguous; the
   engine's auto-hide on it is recorded in the cycle report, not tuned away.

## Datasets

- `rule-engine-v8-dev.json`: 15 items (13 clear: 8 HIDE / 5 ALLOW; 2 ambiguous).
- `rule-engine-v8-test.json`: 12 items (10 clear: 5 HIDE / 5 ALLOW; 2 ambiguous).
- Single-author synthetic provenance; split-leakage trigram check enforced by
  the harness like V7.
