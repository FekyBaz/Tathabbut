# V5 annotation audit and category readiness

## Audit and reviewer availability

The existing policy distinguishes targeted harassment from criticism of claims/code/products and defines hate as demeaning, exclusionary, or threatening abuse directed at people because of identity. It explicitly excludes criticism of doctrine, institution, ideology, or policy; mention of identity alone; and a personal slur against one individual unless a group is targeted too. These are appropriate operational distinctions, but “protected or otherwise policy-designated identity” does not enumerate the designated scope; independent policy review should set that boundary before deploying hate rules.

V4 examples mostly follow those distinctions. Positive group cases pair dehumanization or exclusion with a named group; negatives include policy/institution disagreement, neutral mention, and counterspeech. The examples are clear under their supplied text, but one example per language/script and category does not establish consistent annotation. “Atheists” may be a belief identity or philosophical position depending on use; the V4 positive explicitly targets adherents, while criticism-only controls should be expanded. The Arabizi targets (`so3odeyeen`, `moslimeen`) are synthetic transliterations, not evidence of dialect-wide convention. No V4 label is independently reviewed or adjudicated.

No independent reviewers or suitable consented/source-cleared data were available in the workspace for this task. I did not represent the labels as independent. The protocol in `ANNOTATION_GUIDELINES.md` specifies two blinded language-capable annotators, a third blinded adjudicator, retained original judgments, unresolved ambiguity handling, provenance, privacy/consent controls, and split blinding. The V5 synthetic items are task-author labels only.

## Exact hate-rule diagnosis

`extension/src/policy.ts` has exactly one `hate` pattern: `\b(?:all|every) (?:members of )?(?:group) are (?:vermin|subhuman)\b`. It requires the literal placeholder word `group`, and only English `all/every` framing. None of the positive V2/V3/V4 examples uses the literal phrase “all group are vermin/subhuman.” Thus the observed zero recall follows directly from missing target grammar/vocabulary and language coverage, not normalization, precedence, or category conflict. There is no evidence to replace this placeholder safely without reviewed identity-specific contrasts. No hate rule change was made.

## V4 harassment misses and V5 development cycle

V4 misses were `v4d-harassment-en-1` (“You are a clueless fraud”), `v4d-harassment-mixed-5` (“You are أهبل ...”), and `v4t-harassment-en-1` (“You are an absolute joke of a coworker”). Mechanism: the English personal-insult regex enumerates a fixed set of English predicates and the Arabic patterns require Arabic-script pronouns/insults; no rule covered fraud/joke degradation, an English pronoun followed by Arabic insult, or Arabizi `faker`.

V5a first-cycle sets were accidentally scored together before tuning, including their frozen test. Those test outcomes are contaminated for an untouched post-change estimate and were not used to choose changes. They are retained with provenance for audit, not used below as validation evidence. To avoid using that test for tuning, a distinct V5b development cycle and separately drafted V5b test candidate were created. The V5b test was also run by the same baseline command before any V5b changes, exposing its baseline outcomes. I used only V5b development failures when selecting patterns; nevertheless, because the test was previously seen, its final score is not presented as untouched held-out evidence. No independent or clean V5 test estimate is available.

### V5b development baseline and final rule

V5b development contains 16 clear synthetic items, four per language/script. Baseline: TP=1, FP=0, TN=12, FN=3; precision=1.000, recall=0.250, F1=0.400. Per-language baseline: Arabic 4: `1/0/3/0`; English 4: `0/0/3/1`; mixed 4: `0/0/3/1`; Arabizi 4: `0/0/3/1` (TP/FP/TN/FN).

Development-supported additions cover narrowly: English `you are + fraud/joke`, English “joke of a [coworker/teammate/employee/manager]”, Arabic second-person pronoun plus English `fraud/joke/faker`, English `you are + normalized Arabic اهبل`, and Arabizi `enta faker`. V5b final: TP=4, FP=0, TN=12, FN=0; precision=1.000, recall=1.000, F1=1.000. Per-language final: Arabic 4: `1/0/3/0`; English 4: `1/0/3/0`; mixed 4: `1/0/3/0`; Arabizi 4: `1/0/3/0`. This is an in-sample development gain on 4 positives and 12 hard negatives, created by the rule author; it is not an independent estimate. Root cause coverage remains limited and the patterns do not establish semantic understanding.

### Contrastive tests and known limitations

Regression tests pair each new pattern with object, product, code, argument, and reported-language negatives. No development false positives were observed. Existing V2/V3/V4 datasets and tests remain unchanged; V4 frozen test errors were not used for V5 rule selection. The V5 synthetic tests were added after those test outcomes were already seen, therefore their accuracy cannot be claimed as independent validation. V5 files include per-item provenance and rationale and are single-author.

## Readiness recommendation

| Category | Recommendation | Evidence and next step |
| --- | --- | --- |
| Harassment | **Still needs deterministic work; not ready to claim category reliability.** | The V5b patterns improve a focused dev set from 1/4 to 4/4 positives without dev FPs, but all labels are single-author, synthetic, and four positives per language. Obtain independent adjudicated hard cases and a genuinely untouched test before a controlled model comparison. |
| Hate | **Lacks sufficient evaluation evidence; not ready for a controlled comparison of detector quality.** | V2–V4 show repeated zero recall against a placeholder, but V4 had only four positives per split and no independent review. Freeze precise identity policy, build broad same-target hard negatives, and obtain fluent independent reviewers. |
| Threats | **Ready only for a narrowly scoped controlled experiment if dataset readiness is met; overall category evidence remains limited.** | Specific English body-part and existing direct threat forms have synthetic challenge coverage, but V4 support is tiny and no independent annotation exists. Validate with consented, independently adjudicated examples first. |
| Spam | **Ready only for a narrowly scoped controlled experiment if dataset readiness is met; overall category evidence remains limited.** | The specific Arabizi prize/private/claim construction has synthetic controls and one new cycle, but broad spam coverage and prevalence are not measured. |

No real-world accuracy or plateau is claimed. More deterministic improvements remain plausible for explicit forms. A meaningful model-phase gate requires independent annotation, enough positive and hard-negative support per category/language, a truly untouched test, confidence intervals, and predeclared per-category false-positive limits. The small synthetic V5 cycles do not meet that gate.
