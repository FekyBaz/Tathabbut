"""Parity check: the backend starter rules must agree with eval/dataset.json strict guardrails."""

import json
from pathlib import Path

from tathabbut_api.classifier import classify
from tathabbut_api.schemas import ClassifyRequest

DATASET = json.loads((Path(__file__).resolve().parents[2] / "eval" / "dataset.json").read_text(encoding="utf-8"))
ALL_CATEGORIES = ["harassment", "hate", "threats", "spam"]


def _predicted(text: str) -> list[str]:
    response = classify(ClassifyRequest(text=text, enabled_categories=list(ALL_CATEGORIES)))
    return sorted(label.category for label in response.labels)


def test_strict_items_match_shared_dataset() -> None:
    failures = []
    for item in DATASET["items"]:
        if not item["strict"]:
            continue
        predicted = _predicted(item["text"])
        if predicted != sorted(item["expect"]):
            failures.append(f"{item['id']}: expected {sorted(item['expect'])} got {predicted}")
    assert failures == []


def test_hamza_spam_variant_matches_after_normalization() -> None:
    item = next(entry for entry in DATASET["items"] if entry["id"] == "ar-spm-002")
    assert "spam" in _predicted(item["text"])
