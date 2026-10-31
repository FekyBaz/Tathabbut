# V2 failure trace and V3 dispositions

## V2 failure inventory

The v2 evaluator reported 13 false negatives and no false positives: 7 development misses and 6 frozen-test misses. Each miss had `actual labels=[]`.

| Item ID | Category | Expected → actual | Exact mechanism in `policy.ts` | Cause | Smallest plausible deterministic fix |
| --- | --- | --- | --- | --- | --- |
| `v2d-hate-en-p1` | hate | `[hate]` → `[]` | The only English hate regex requires the literal noun `group` in `all/every ... group are vermin/subhuman`; the input names Muslims. | Missing target vocabulary/pattern; not normalization. | Add explicitly reviewed identity targets to a narrow group-dehumanization pattern, with matched policy/ideology negatives. Not justified as a general list by this sample. |
| `v2d-hate-ar-p1` | hate | `[hate]` → `[]` | No Arabic hate pattern exists; the sole hate pattern is English-only. | Missing pattern and target coverage. | A reviewed Arabic group-target/predicate grammar plus contrastive negatives. Not justified from one positive. |
| `v2d-hate-mix-p1` | hate | `[hate]` → `[]` | No mixed-script group-target pattern; English regex also requires literal `group`. | Missing pattern. | Add mixed phrase patterns only after more target and policy hard negatives. |
| `v2d-hate-ab-p1` | hate | `[hate]` → `[]` | No Arabizi normalization or hate regex; text remains Latin transliteration. | Missing transliteration coverage. | A reviewed transliteration lexicon and grammar; not safe to infer broadly from one item. |
| `v2t-hate-en-p1` | hate | `[hate]` → `[]` | Literal `group` condition fails on “Disabled people”; no corresponding identity term. | Missing target vocabulary/pattern. | Same policy-reviewed target expansion as above; no broad dictionary added. |
| `v2t-hate-ar-p1` | hate | `[hate]` → `[]` | No Arabic hate pattern. | Missing pattern. | Arabic group-target grammar after broader annotation. |
| `v2t-hate-mix-p1` | hate | `[hate]` → `[]` | No mixed-script pattern; English regex cannot match the Arabic target/predicate composition. | Missing pattern. | Mixed-script construction plus hard negatives, supported by a larger dev set. |
| `v2t-hate-ab-p1` | hate | `[hate]` → `[]` | No Arabizi target/predicate normalization or pattern. | Missing pattern. | Transliteration work after a reviewed vocabulary and contrastive data exist. |
| `v2d-t-ab-p1` | threats | `[threats]` → `[]` | Threat patterns cover selected English forms and Arabic-script forms such as `هقتلك`; `ha2telek` stays Latin under NFKC and matches neither. | Missing pattern/language support; not an Arabic normalization defect. | Recognize a narrow set of attested second-person Arabizi harm forms, with explicit negation and attribution controls. Implemented in V3. |
| `v2t-t-ab-p1` | threats | `[threats]` → `[]` | `hadrabak` has no Latin-script threat pattern. | Missing pattern/language support. | Same narrowly scoped Arabizi family, including report and negation handling. Implemented in V3. |
| `v2d-s-mix-p1` | spam | `[spam]` → `[]` | Arabic spam alternatives require exact phrases (`مبروك كسبت الجائزة`, `ابعتلي خاص عشان تكسب`, etc.); English alternatives require exact English phrases. The example interleaves `prize` with `ابعتلي خاص ... تستلم`, so no alternative matches. | Missing cross-language phrase composition. | Require reward cue + private solicitation + claim/collection action together. Implemented in V3 with hard negatives for past prizes and ordinary messages. |
| `v2d-s-ab-p1` | spam | `[spam]` → `[]` | No Arabizi spam pattern; English and Arabic alternatives do not match the Latin spellings. | Missing pattern/language support. | Narrow claim phrase with every solicitation component required. Implemented in V3; test generalization remains incomplete. |
| `v2t-s-ab-p1` | spam | `[spam]` → `[]` | Same script gap; the rule set has no Arabizi normalization or spam pattern. | Missing pattern/language support. | Same narrow pattern. The new V3 test still exposes an unseen opener variant. |

## Other root causes exposed while building V3 development data

- `v3d-t-en-p1`, **threats**, expected `[threats]`, actual `[]`: “I'll break your jaw” does not match the English threat regex, whose harm verbs are `kill|hurt|attack|punch|stab|shoot|end` (or `beat ... up`) and whose target slot is a pronoun. It is a missing construction, not normalization. A body-part-target rule is plausible, but this cycle did not add it because the frozen V3 test does not cover that construction.
- `v3d-s-en-p1`, **spam**, expected `[spam]`, actual `[]` before the V3 cue fix: `REPORTING_CUE` included the standalone alternative `phrase`, so `classificationText()` truncated “Send your wallet phrase now to unlock guaranteed profit” at `phrase`, before the spam regex could see `guaranteed profit`. This was precedence/context handling, not missing spam vocabulary. V3 removes the standalone cue and protects explicit abuse discussion with a more specific pattern.
- `v3d-h-ab-p1`, **harassment**, expected `[harassment]`, actual `[]` before the V3 addition: Arabic includes vocative `يا أهبل`, while Arabizi rules covered `ya 7mar` and `enta ... ahbal` but not `ya ahbal`. This was one missing phrase form. V3 adds that whole phrase and tests an attributed/reporting negative.

## V3 changes and measurements

The V3 development split has 35 clear items after adding hard negatives. Comparable before/after counts on those same items:

| Category | Before TP/FP/TN/FN | After TP/FP/TN/FN | Before F1 | After F1 | Change |
| --- | --- | --- | ---: | ---: | --- |
| Harassment | 3 / 0 / 31 / 1 | 4 / 0 / 31 / 0 | 0.857 | 1.000 | Added exact `ya ahbal` coverage; its reported-speech negative stayed visible. |
| Threats | 2 / 0 / 31 / 2 | 3 / 0 / 31 / 1 | 0.667 | 0.857 | Added three attested Arabizi forms, explicit `mesh/msh` negation suppression, and `howa/heya/homma 2al/2alet/...` attribution cue. |
| Spam | 1 / 0 / 31 / 3 | 4 / 0 / 31 / 0 | 0.400 | 1.000 | Added mixed reward/private-claim composition, a narrow Arabizi claim phrase, and removed the broad `phrase` truncation cue. |
| Hate | 0 / 0 / 31 / 4 | 0 / 0 / 31 / 4 | 0.000 | 0.000 | No rule change: the development data do not justify a complete, safe target vocabulary. |

No development false positives were introduced. Relevant controls include explicit Arabizi negation and reported threats, past prize mentions, ordinary private messages, product/code criticism, an explicitly discussed insult phrase, and all 31 negatives per category.

The V3 frozen-test results, scored after the changes were frozen, are: harassment TP=4 FP=0 TN=28 FN=0; threats TP=4 FP=0 TN=28 FN=0; hate TP=0 FP=0 TN=28 FN=4; spam TP=3 FP=0 TN=28 FN=1. The remaining spam miss is `v3t-s-ab-p1`: it starts `enta kasabt`, while the V3 Arabizi rule deliberately requires the development-supported `mabrook/mabrouk kasabt` opening. Do not tune this frozen test; collect more Arabizi openers and matched benign prize reports in the next cycle.

V3 uses synthetic single-author examples. Its test split was separate and frozen before V3 rule edits, but it is not independently human-authored, representative feed data, or evidence of real-world accuracy. The test outcomes must be treated as a future development signal, not as authorization to patch against the same split.
