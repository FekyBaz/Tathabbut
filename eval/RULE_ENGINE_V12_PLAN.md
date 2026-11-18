# V12 rule-engine cycle: Arabizi personal-abuse grammar variants

> Written **before implementation**, following the same discipline as V8–V11.

## Scope (one gap only)

The reviewed insult vocabulary is covered in Arabic script and a few Arabizi
forms (`enta ghaby`, `ya ahbal`, `ya 7mar`), but the same reviewed insults with
other personal pronouns are uncovered:

- Second person: `enta/inti/antu/entu + 7mar/7mara/fashel/fashla/ahbal`
  (feminine, plural, and insults beyond `ghaby`).
- Third person: `howa/heya + 7mar/7mara/fashel/fashla/ghaby/ghabia/ahbal`
  (the V8 authored-abuse rule extended to Arabizi).

All insult tokens are attested transliterations of words already reviewed in
the Arabic-script rules; no new insult semantics or fuzzy transliteration is
introduced.

Out of scope and recorded as residual: new Arabizi insult tokens, threats
verbs beyond `ha2telek/hadrabak/haksarak`, negation gaps in the **existing**
`enta ghaby`/`enta faker` patterns (e.g. `mish enta ghaby`), and phonetic
spelling variants (`enta 7omaar` etc.).

## Evidence

- `RULE_ENGINE_GAPS.md` P1: Arabizi constructions and reported speech remain
  under-sampled beyond `ya ahbal`.
- `RULE_ENGINE_V8_CYCLE_REPORT.md` lists Arabizi third person (`howa fashel`)
  as an unsupported form.
- No prior V7–V11 dataset contains the V12 positive phrasings.

## Protected hard negatives

1. Negation: `mish enta 7mar`, `mesh inti ghabia` — the new pattern must
   carry a narrow negative lookbehind for `mish|mesh|msh`.
2. Attribution: `howa 2al enta 7mar`, `heya 2alet howa 7mar` — the existing
   Arabizi reporting cue must keep suppressing reported abuse.
3. Object/idea criticism: `el project fashel`, `el plan fashel`,
   "The design is stupid."
4. Self-description: `ana 7mar`.
5. Factual third-person: `howa engineer w heya doctor`.
6. Literal animal: `el 7mar fi el mazra3a`, `7mar w 7omar fi el mazra3a`.

## Implementation sketch

- Append two harassment patterns (`harassment.26` second person,
  `harassment.27` third person; exact IDs verified after implementation).
- Both use a `(?<=^|[\s،,.!?؟])` boundary lookbehind so the match starts at
  the pronoun; the second-person pattern adds
  `(?<!\b(?:mish|mesh|msh)\s+)` for negation.
- Insult tokens are closed; no `[7h]`-style fuzzy classes or optional vowels.

## Acceptance criteria

1. All V12 dev clear items pass; pre-change failures recorded.
2. Held-out evaluated once after freezing, without tuning.
3. No regression on V1–V11 splits, the 59-item corpus, or the full
   extension/backend suites.
4. Joke-frame ambiguous items remain a documented FP risk, not tuned away.

## Datasets

- `rule-engine-v12-dev.json`: 14 items (12 clear: 6 HIDE / 6 ALLOW; 2 ambiguous).
- `rule-engine-v12-test.json`: 11 items (10 clear: 5 HIDE / 5 ALLOW; 1 ambiguous).
- Single-author synthetic provenance; trigram split-leakage and unique-ID
  checks enforced by the harness.
