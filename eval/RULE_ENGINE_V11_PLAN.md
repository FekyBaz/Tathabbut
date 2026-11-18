# V11 rule-engine cycle: bounded repeated-character normalization and one reviewed alias

> Written **before implementation**, following the same discipline as V8–V10.

## Scope (one gap only)

Attested misspelled abuse evades the reviewed vocabulary:

- Stretched spelling (`idiooot`, `pathhhhetic`, `غبييي`) — supported by the
  documented v1 dev miss `dev-repeat-1`.
- One attested single-omission form, `idot`, supported by the documented v1
  held-out miss `test-repeat-1`.

V11 applies exactly two bounded mechanisms and nothing else:

1. Collapse runs of **3+ identical letters** to one letter inside
   `normalizeForRules` (script-neutral; ordinary doubled letters like
   `all`, `see`, `too`, `free`, `coffee` are untouched).
2. Add one reviewed alias, `idot`, to a new second/third-person harassment
   pattern that keeps the grammatical target requirement.

Out of scope and documented as residual: general edit distance, other omission
typos (`chokke`), fuzzy transliteration, and any normalization of single-letter
substitutions.

## Evidence

- `RULE_ENGINE_GAPS.md` P2: `idiooot` and `idot` are both missed; fuzzy
  matching was explicitly deferred pending adversarial typo vs benign-word
  pairs.
- The V1 dev/held-out items are cited as documented evidence only; all V11
  dev and held-out texts are newly authored with the required benign stretch
  controls.

## Protected hard negatives

1. Benign emphatic stretches: `soooo beautiful`, `loooove`, `Yessss`,
   `cooool`, `Noooo`, `ههههه` (laughter).
2. Doubled-letter controls: `all`, `coffee`, `success`.
3. Near-miss and untargeted alias: `idol`, "The idot report is on the desk."
4. Stretched non-insult: `فاهممم`.
5. Ambiguous joke frames with insult typos are labeled ambiguous (excluded
   from metrics) and not tuned away.

## Implementation sketch

- In `normalizeForRules`, after apostrophe/Alef normalization and before
  whitespace collapse, add `/([^\W\d_])\1{2,}/giu → "$1"`.
- Append one harassment pattern (`harassment.25`, exact ID verified after
  implementation) for `you're/you are/he's/he is/she's/she is + (a/an)? idot`.
- No new insult tokens other than the reviewed alias; no edit-distance or
  phonetic matching; no changes to existing pattern bodies.

## Acceptance criteria

1. All V11 dev clear items pass; pre-change failures recorded.
2. Held-out evaluated once after freezing, without tuning.
3. No regression on V1–V10 splits, the 59-item corpus, or the full
   extension/backend suites — in particular no new false positives from
   benign stretches.
4. The residual omission-typo gap (`chokke`) is labeled ambiguous in held-out
   and stays documented, not patched.

## Datasets

- `rule-engine-v11-dev.json`: 15 items (13 clear: 6 HIDE / 7 ALLOW; 2 ambiguous).
- `rule-engine-v11-test.json`: 11 items (9 clear: 4 HIDE / 5 ALLOW; 2 ambiguous).
- Single-author synthetic provenance; trigram split-leakage and unique-ID
  checks enforced by the harness.
