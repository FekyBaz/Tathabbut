# V13 rule-engine cycle: third-person plural and past-tense personal abuse

> Written **before implementation**, following the same discipline as V8–V12.

## Scope (one gap only)

V8 covered third-person **singular present** abuse (`he's/she's + insult`).
The same reviewed vocabulary is uncovered with:

- plural present: `they're/they are + insult` (including plural count nouns
  such as `idiots`, `morons`, `clowns`);
- past tense: `he was/she was/they were + insult`.

All insult tokens are the already-reviewed V8 vocabulary; the plural `s` is
morphology, not a new insult. Out of scope: Arabizi plural/past forms,
second-person past (`you were`), identity-targeted hate, and any insults
with the target omitted.

## Evidence

- `RULE_ENGINE_V8_CYCLE_REPORT.md` explicitly lists third-person plural and
  past tense as unsupported, recorded rather than tuned.
- `RULE_ENGINE_CEILING_ASSESSMENT.md` names plural/past-tense harassment as a
  remaining narrow deterministic gap.

## Protected hard negatives

1. Factual and state descriptions: "They're engineers.", "He was the
   manager.", "She was tired."
2. Activity clauses where a verb follows the pronoun: "They're designing the
   new API.", "They're reviewing the code."
3. Object/idea criticism: "Their code is pathetic.", "Their ideas are stupid."
4. Negation: "They're not idiots.", "He wasn't stupid.", "They weren't
   clowns."
5. Attribution: "She said they're idiots."
6. Ambiguous joke/benign frames are labeled ambiguous and not tuned away.

## Implementation sketch

- Append one harassment pattern (`harassment.28`, verified after
  implementation) with the existing intensifier alternatives and the V8
  insult list, extended with optional plural `s` on count nouns.
- Copula set: `they're|they are|he was|she was|they were`. Negation and
  attribution are handled structurally (no `not`/contracted `n't` adjacency
  and the existing reporting cue), with no exception lists.

## Acceptance criteria

1. V13 dev clear items pass; pre-change failures recorded.
2. Held-out evaluated once after freezing, without tuning.
3. No regression on V1–V12 splits, the 59-item corpus, or the full
   extension/backend suites.
4. Joke/benign-frame FPs remain documented, not tuned away.

## Datasets

- `rule-engine-v13-dev.json`: 15 items (13 clear: 6 HIDE / 7 ALLOW; 2 ambiguous).
- `rule-engine-v13-test.json`: 11 items (10 clear: 5 HIDE / 5 ALLOW; 1 ambiguous).
- Single-author synthetic provenance; trigram split-leakage and unique-ID
  checks enforced by the harness.
