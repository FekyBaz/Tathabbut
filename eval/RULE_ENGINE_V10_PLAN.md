# V10 rule-engine cycle: spam co-occurrence with expanded private-contact cues

> Written **before implementation**, following the same discipline as V8/V9.

## Scope (one gap only)

The existing mixed-script spam co-occurrence rule (`spam.4`) requires the triad
**reward opener + private contact + claim/collection**, but its private-contact
vocabulary is closed to `ابعتلي خاص/رسالة خاصة` and `dm me privately`. High-confidence
prize bait using `dm me in private`, `message me privately`, `كلمني على الخاص`,
`راسلني على الخاص`, or `بعتلي على الخاص` stays at REVIEW despite all three
signals. V10 adds one appended pattern with the expanded private-contact cue
set; the reward and claim/collect requirements stay unchanged.

Out of scope: generic promotion wording, repeated-link spam, typo/fuzzy
matching, and any rule that hides on reward wording alone (spam.1/spam.3 remain
contextual and visible).

## Evidence

- `RULE_ENGINE_GAPS.md` P1 records spam opener variation as the next
  deterministic step after the V3 Arabizi opener was covered.
- Source inspection of `spam.4`/`spam.5` shows the closed private-contact cue
  lists.
- No prior dataset contains the V10 positive phrasings, so held-out items are
  new constructions rather than re-tuned V3 cases.

## Protected hard negatives

1. Ordinary logistics: "DM me the room number before the lecture.",
   "ابعتلي موقع القاعة على الخاص لو سمحت."
2. Past prize reports: "I won a prize at the school fair and collected it
   yesterday." — the claim/collect cue must be word-bounded so `collected`
   does not satisfy it.
3. Two-of-three triad cases: "message me privately to say hi" (no claim),
   "collect your certificate from the office" (no private contact),
   "مبروك كسبت الجائزة ... عشان نهنئك" (no collection).
4. Ambiguous legitimate raffles with committee attribution are labeled
   ambiguous (excluded from metrics) and not tuned away.

## Implementation sketch

- Append one spam pattern at the end of the array (`spam.6`, exact ID verified
  after implementation), high specificity (no CONTEXTUAL_RULE_IDS entry), so
  successful triads auto-hide at the existing threshold.
- Keep the reward lookahead identical to `spam.4`; expand only the private
  contact lookahead; use word-bounded `claim`/`collect` so past-tense
  `collected` does not count as a claim action.
- No change to generic promotion, prize-only, Arabizi `kasabt`, or link-count
  rules.

## Acceptance criteria

1. V10 dev clear items pass after the change; pre-change failures recorded.
2. V10 held-out evaluated once after freezing, without tuning.
3. No regression on V1–V9 splits, the 59-item classification corpus, or the
   extension/backend suites.
4. No new false positives on legitimate prize announcements, ordinary private
   requests, or past prize reports.

## Datasets

- `rule-engine-v10-dev.json`: 14 items (11 clear: 5 HIDE / 6 ALLOW; 3 ambiguous).
- `rule-engine-v10-test.json`: 10 items (8 clear: 4 HIDE / 4 ALLOW; 2 ambiguous).
- Single-author synthetic provenance; trigram split-leakage and unique-ID
  checks enforced by the harness.
- Pre-implementation audit correction (disclosed): the two "congratulate only"
  items contained the literal prize phrase that already triggers contextual
  `spam.3`, so their labels were corrected from clear ALLOW to ambiguous
  REVIEW **before** any rule implementation or post-change scoring. Texts and
  split membership are unchanged.
