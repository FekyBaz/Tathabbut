# V9 rule-engine cycle: additional high-confidence injury constructions

> Written **before implementation**, following the same discipline as V8 and
> [`RULE_ENGINE_V7_METHODOLOGY.md`](RULE_ENGINE_V7_METHODOLOGY.md).

## Scope (one gap only)

The closed injury-verb/body-part vocabularies in `threats.1`, `threats.2`, and
`threats.4` leave high-confidence first-person injury threats uncovered:

- English: `I'll / I'm going to / I will + choke + you/him/her/them`,
  `knock + your/his/her/their + teeth out`,
  `break + your/his/her/their + face/skull`.
- Egyptian Arabic: `هخنق + ك/ها/هم/ه` (first-person future injury with a
  personal object suffix).

This is one vocabulary-extension gap (injury predicates with an explicit human
object), not a general threat grammar. Out of scope and recorded as residual:
second-person perfect (`you're dead`), threats without first-person intent,
Arabizi additional verbs, and past-tense injury reports.

## Evidence

- Source inspection of the closed verb lists in `extension/src/policy.ts`
  (`kill|hurt|attack|punch|stab|shoot|end`, `break|smash + jaw|nose|...`) and
  the Arabic verb list (`هقتلك|هذبحك|هضربك|هكسرك|...`): the V9 positive forms
  match none of them.
- `RULE_ENGINE_GAPS.md` P1 records threat-construction coverage as the next
  deterministic priotity after the V3 body-part form was covered.
- No prior dataset contains `choke`, `knock`, `هخنق`, `face`, or `skull`
  as a threat predicate, so the new items are not re-tuned held-out cases.

## Protected hard negatives (authored before code)

1. **Benign idioms:** "This update will knock your socks off."
2. **Self-directed:** "I'll choke on my coffee if I eat too fast."
3. **Technical objects:** "We need to break the build before release." /
   "هخنق العملية دي لو علقت" / "I'll choke the process if it hangs."
4. **Benevolent action:** "I'm going to break your fall with this cushion."
5. **Negation:** "مش هخنقك، خلينا نحل المشكلة بالكلام" and the suffixed
   Egyptian frame "ما هخنقكش، أنا عايز أتكلم." — the attested negation
   suppression must be extended to the new verb, including the trailing ش.
6. **Attribution/modality:** "قال هخنقك لو رجعت للشارع ده." /
   "She said she would choke you."
7. **Fiction/non-human objects:** "The hero will choke the villain..." /
   "I'm going to choke the noise with this cushion."

## Implementation sketch

- Append two threat patterns at the end of the array to preserve all existing
  rule IDs. Estimated before implementation as `threats.6`/`threats.7`;
  verified after implementation as `threats.7` (English) and `threats.8`
  (Arabic) because six threat patterns already existed. The legacy IDs
  `threats.2` (body-part) and `threats.4` (Arabic) are unchanged.
- English pattern requires the existing first-person future-intent forms and
  a human object; the `knock` alternative requires `teeth out` specifically,
  never an arbitrary possessive object.
- Arabic pattern requires the personal object suffix directly after `هخنق`
  and a trailing boundary, so a bare verb + noun object cannot match.
- Extend the existing attested Arabic negation replacement with the new verb,
  including the optional trailing ش, preserving the existing `ولا` chaining.
- Two ambiguous banter items are documented but not tuned away.

## Acceptance criteria

1. All V9 dev clear items pass before held-out scoring (positives and
   protected negatives); pre-change dev failures are recorded in the report.
2. V9 held-out evaluated once after freezing, with no tuning on it.
3. No regression: V1–V8 datasets, the 59-item classification corpus, and all
   existing extension/backend tests stay green.
4. No new false positives on criticism, quoting, reporting, or technical
   `choke`/`break` idioms in any frozen split.

## Datasets

- `rule-engine-v9-dev.json`: 16 items (14 clear: 6 HIDE / 8 ALLOW; 2 ambiguous).
- `rule-engine-v9-test.json`: 12 items (11 clear: 5 HIDE / 6 ALLOW; 1 ambiguous).
- Single-author synthetic provenance; the harness enforces the trigram
  near-duplicate split check as in V7/V8.
