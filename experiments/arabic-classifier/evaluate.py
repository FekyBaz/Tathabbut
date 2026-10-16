"""Controlled comparison: MARBERTv2 Egyptian hate-speech classifier vs the
Tathabbut rule baseline (backend mirror of extension/src/policy.ts) on a
small synthetic Egyptian/MSA set. No production code is touched.

Run from the repo root:
    python experiments/arabic-classifier/evaluate.py [--smoke]

Outputs experiments/arabic-classifier/results.json (aggregate metrics plus
per-item predictions on synthetic fixture text only).
"""

import json
import os
import sys
import time
from pathlib import Path

EXP_DIR = Path(__file__).resolve().parent
REPO_ROOT = EXP_DIR.parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend" / "src"))

MODEL_ID = "IbrahimAmin/marbertv2-finetuned-egyptian-hate-speech-classification"
MODEL_HARMFUL = {"Offensive", "Sexism", "Religious Discrimination", "Racism"}

ALL_CATEGORIES = ["harassment", "hate", "threats", "spam"]


def load_dataset():
    with open(EXP_DIR / "dataset.json", encoding="utf-8") as f:
        data = json.load(f)
    assert data["version"] == "0.1.0"
    for item in data["items"]:
        assert set(item) >= {"id", "text", "expected", "category", "ambiguous"}
        assert item["expected"] in ("harmful", "harmless")
    ids = [i["id"] for i in data["items"]]
    assert len(ids) == len(set(ids)), "duplicate item ids"
    return data


def run_rules(items):
    from tathabbut_api.classifier import classify
    from tathabbut_api.schemas import ClassifyRequest

    out = []
    start = time.perf_counter()
    for item in items:
        t0 = time.perf_counter()
        try:
            response = classify(ClassifyRequest(text=item["text"], enabled_categories=list(ALL_CATEGORIES)))
            labels = [label.category for label in response.labels]
            out.append({"id": item["id"], "predicted": "harmful" if labels else "harmless",
                        "labels": labels, "latencyMs": (time.perf_counter() - t0) * 1000,
                        "error": None})
        except Exception as e:  # noqa: BLE001 - errors are reported, never hidden
            out.append({"id": item["id"], "predicted": "error", "labels": [],
                        "latencyMs": (time.perf_counter() - t0) * 1000,
                        "error": type(e).__name__ + ": " + str(e)[:200]})
    wall = (time.perf_counter() - start) * 1000
    return out, wall


def run_model(items):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    torch.set_num_threads(1)
    t0 = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=False)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID, trust_remote_code=False)
    model.eval()
    load_ms = (time.perf_counter() - t0) * 1000
    try:
        revision = model.config._commit_hash
    except Exception:  # noqa: BLE001
        revision = None

    out = []
    with torch.no_grad():
        for item in items:
            t1 = time.perf_counter()
            try:
                inputs = tokenizer(item["text"], return_tensors="pt", truncation=True, max_length=512)
                logits = model(**inputs).logits[0]
                probs = logits.softmax(dim=-1).tolist()
                best = max(range(len(probs)), key=lambda i: probs[i])
                id2label = model.config.id2label
                label = id2label[best] if best in id2label else id2label[str(best)]
                out.append({"id": item["id"], "predicted": "harmful" if label in MODEL_HARMFUL else "harmless",
                            "labels": [label],                             "scores": {id2label[i]: round(p, 4) for i, p in enumerate(probs)},
                            "latencyMs": (time.perf_counter() - t1) * 1000, "error": None})
            except Exception as e:  # noqa: BLE001 - reported explicitly, never silent fallback
                out.append({"id": item["id"], "predicted": "error", "labels": [], "latencyMs": 0.0,
                            "error": type(e).__name__ + ": " + str(e)[:200]})
    return out, load_ms, revision, model


def metrics(scored, predictions):
    by_id = {p["id"]: p for p in predictions}
    tp = fp = tn = fn = errors = 0
    per_category, respectful_fp, respectful_n = {}, 0, 0
    for item in scored:
        pred = by_id[item["id"]]["predicted"]
        if pred == "error":
            errors += 1
            continue
        actual = item["expected"]
        cat = per_category.setdefault(item["category"], {"tp": 0, "fp": 0, "tn": 0, "fn": 0})
        if actual == "harmful" and pred == "harmful":
            tp += 1
            cat["tp"] += 1
        elif actual == "harmless" and pred == "harmless":
            tn += 1
            cat["tn"] += 1
        elif actual == "harmless" and pred == "harmful":
            fp += 1
            cat["fp"] += 1
            if item["category"] == "respectful":
                respectful_fp += 1
        elif actual == "harmful" and pred == "harmless":
            fn += 1
            cat["fn"] += 1
        if item["category"] == "respectful":
            respectful_n += 1
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 1.0
    return {
        "n": len(scored), "tp": tp, "fp": fp, "tn": tn, "fn": fn, "errors": errors,
        "precision": round(precision, 4), "recall": round(recall, 4),
        "f1": round(2 * precision * recall / (precision + recall), 4) if precision + recall else 0.0,
        "falsePositiveRateRespectful": round(respectful_fp / respectful_n, 4) if respectful_n else None,
        "falseNegativeRateHarmful": round(fn / (tp + fn), 4) if tp + fn else None,
        "perCategory": per_category,
    }


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="4 fixed items only, asserts rules baseline")
    args = parser.parse_args()

    data = load_dataset()
    items = data["items"]
    if args.smoke:
        items = [i for i in data["items"] if i["id"] in ("ins-01", "res-01", "thr-01", "neu-01")]
    scored = [i for i in items if not i["ambiguous"]]
    ambiguous = [i for i in items if i["ambiguous"]]

    try:
        import psutil

        proc = psutil.Process(os.getpid())
        rss_before = proc.memory_info().rss
    except Exception:  # noqa: BLE001
        proc, rss_before = None, None

    rules_preds, rules_wall_ms = run_rules(items)
    if args.smoke:
        expected = {"ins-01": "harmful", "res-01": "harmless", "thr-01": "harmful", "neu-01": "harmless"}
        for pred in rules_preds:
            assert pred["predicted"] == expected[pred["id"]], pred
            assert pred["error"] is None
        print("SMOKE OK: rules baseline deterministic on 4 fixed items")
        return 0

    model_preds, load_ms, revision, model = run_model(items)

    import torch
    from transformers import __version__ as transformers_version

    artifact_bytes = 0
    from huggingface_hub import snapshot_download

    snapshot = Path(snapshot_download(MODEL_ID))
    for path in snapshot.rglob("*"):
        if path.is_file() and path.suffix in (".safetensors", ".bin", ".json", ".txt", ".model"):
            artifact_bytes += path.stat().st_size
    rss_after = proc.memory_info().rss if proc else None

    model_lat = [p["latencyMs"] for p in model_preds if not p["error"]]
    rules_lat = [p["latencyMs"] for p in rules_preds if not p["error"]]
    report = {
        "model": {"id": MODEL_ID, "revision": revision, "transformers": transformers_version,
                  "torch": torch.__version__, "device": "cpu", "threads": 1,
                  "metrics": metrics(scored, model_preds),
                  "avgLatencyMs": round(sum(model_lat) / len(model_lat), 3) if model_lat else None,
                  "coldLoadMs": round(load_ms, 1),
                  "artifactBytes": artifact_bytes,
                  "peakRssDeltaBytes": (rss_after - rss_before) if rss_after and rss_before else None,
                  "errors": [p for p in model_preds if p["error"]]},
        "dataset": {"path": "experiments/arabic-classifier/dataset.json",
                    "version": data["version"], "scored": len(scored),
                    "ambiguousExcluded": len(ambiguous)},
        "rulesBaseline": {"metrics": metrics(scored, rules_preds),
                          "avgLatencyMs": round(sum(rules_lat) / len(rules_lat), 3),
                          "totalWallMs": round(rules_wall_ms, 1)},
        "ambiguousItems": [
            {"id": i["id"], "note": i["note"],
             "rules": next(p["predicted"] for p in rules_preds if p["id"] == i["id"]),
             "model": next(p["predicted"] for p in model_preds if p["id"] == i["id"]),
             "modelLabel": next(p["labels"] for p in model_preds if p["id"] == i["id"])}
            for i in ambiguous
        ],
        "limitations": [
            "Synthetic set (n=%d scored); not real-world traffic." % len(scored),
            "Model labels mapped binary; bullying/mockery/threat distinctions unavailable.",
            "Single CPU thread, batch size 1; no GPU timing.",
        ],
    }
    with open(EXP_DIR / "results.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    print(json.dumps({"rules": report["rulesBaseline"]["metrics"], "model": report["model"]["metrics"],
                      "modelMs": report["model"]["avgLatencyMs"], "loadMs": report["model"]["coldLoadMs"],
                      "bytes": artifact_bytes}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
