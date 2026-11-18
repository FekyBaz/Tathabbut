# V14 rule-engine cycle: negation guard for legacy Arabizi insult patterns

> Written **before implementation**, following the same discipline as V8–V13.

## Scope (one precision gap only)

Two older Arabizi harassment patterns lack the narrow negation guard that the
V12 patterns already have:

- `/\b(?:enta|inti|entu)\s+(?:ghaby|ghabi|ahbal)\b/i`
- `/\benta\s+faker\b/i`

So `mish enta ghaby` and `mesh enta faker` are auto-hidden even though the
insult is explicitly negated. V14 adds a negation lookbehind **in place** to
these two patterns only; their positional rule IDs stay unchanged.

Out of scope: Arabic-script negation patterns (e.g. `مش انت غبي`), vocative
insults, joke/banter frames (contextual, Phase 2), and any new insult tokens.

## Evidence

- `RULE_ENGINE_V12_CYCLE_REPORT.md` records this as a pre-existing negation
  gap deliberately not folded into V12.
- `RULE_ENGINE_CEILING_ASSESSMENT.md` lists it among the remaining narrow
  deterministic gaps.

## Hard negatives and clause-local controls

1. Negated insults: `mish enta ghaby`, `mesh enta faker`, `msh inti ghaby`,
   `mish entu ahbal`, and two negated insults in one message.
2. Hard **positives** proving the guard is clause-local:
   `mish ana ghaby, enta ghaby` and `msh ana faker, enta faker` — negation
   governs the self-description only, so the later insult must still hide.
3. Controls: factual `enta engineer`, English negation `I'm not an idiot`.

## Implementation sketch

- Prepend `(?<!\b(?:mish|mesh|msh)\s+)` to the two legacy patterns without
  moving or replacing them, preserving their rule IDs.
- No changes to V12's already-guarded patterns, Arabic-script rules, or any
  other category.

## Acceptance criteria

1. Dev clear items pass; pre-change baseline (including the FP count) recorded.
2. Held-out evaluated once after freezing, without tuning.
3. Zero regression on V1–V13 splits, the 59-item corpus, and full suites.
4. Joke-frame ambiguous items remain documented, not tuned away.

## Datasets

- `rule-engine-v14-dev.json`: 13 items (11 clear: 4 HIDE / 7 ALLOW; 2 ambiguous).
- `rule-engine-v14-test.json`: 9 items (8 clear: 4 HIDE / 4 ALLOW; 1 ambiguous).
- Single-author synthetic provenance; trigram split-leakage and unique-ID
  checks enforced by the harness.
