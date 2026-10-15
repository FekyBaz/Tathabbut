# Arabic classifier experiment: rules baseline vs MARBERTv2

Controlled, reproducible comparison on a small synthetic Egyptian/MSA set.
Evaluation only — production code is untouched and no model is integrated.

## What was tested

- **Baseline**: Tathabbut rule classifier (`backend/src/tathabbut_api/classifier.py`,
  the tested mirror of `extension/src/policy.ts`), binary flag = any label.
- **Candidate**: `IbrahimAmin/marbertv2-finetuned-egyptian-hate-speech-classification`
  (revision `a641e0c`), BERT-base sequence classifier, 5 labels mapped binary:
  harmful = Offensive/Sexism/Religious Discrimination/Racism, harmless = Neutral.
- **Excluded**: `hugsanaa/CyberAraBERT` — downloadable and Apache-2.0, but its
  classification head predicts `yes`/`no` for an undocumented task objective,
  so no honest mapping to harassment categories exists. Not evaluated.
- **Dataset**: `dataset.json` v0.1.0 (37 scored + 7 ambiguous, synthetic only).

## Reproduce

```bash
python experiments/arabic-classifier/evaluate.py        # full run, writes results.json
python experiments/arabic-classifier/evaluate.py --smoke  # 4-item baseline check
```

Environment used: Python 3.12, torch 2.5.1 CPU (1 thread), transformers 4.47.1,
no GPU. Weights stay in the local HuggingFace cache, never in Git.

## Results (see REPORT.md)

| system | P | R | F1 | FPR respectful | FNR harmful | warm latency |
|---|---|---|---|---|---|---|
| rules | 1.000 | 1.000 | 1.000 | 0.000 | 0.000 | 0.04 ms |
| MARBERTv2 | 1.000 | 0.714 | 0.833 | 0.000 | 0.286 | 45.9 ms |

Rules score perfectly only because the set mirrors their patterns
(self-consistency, not real-world accuracy). The model caught all direct
insults and threats but missed 3/4 mockery items, 1/4 belittling items, and
both spam items (not hate speech by design), and flagged counterspeech
mentioning a slur pattern as Offensive. Costs: 625 MB artifacts, ~8.5 s
cold load, ~929 MB peak RSS delta.

## Recommendation

Do not integrate. The candidate adds no value on the cases rules already
cover deterministically, misses the mockery cases that motivate the work,
costs ~1000x the latency and ~600 MB, and cannot run in the extension
without a major packaging effort the quality numbers do not justify.
