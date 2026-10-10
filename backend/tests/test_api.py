from fastapi.testclient import TestClient

from tathabbut_api.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_classify_direct_insult() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "You are an idiot", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "local-heuristic"
    assert body["labels"][0]["category"] == "harassment"


def test_respectful_criticism_is_not_flagged() -> None:
    response = client.post(
        "/v1/classify",
        json={
            "text": "I disagree with this policy and think it should change.",
            "enabled_categories": ["harassment", "hate", "threats", "spam"],
        },
    )
    assert response.status_code == 200
    assert response.json()["labels"] == []


def test_blank_text_rejected() -> None:
    response = client.post("/v1/classify", json={"text": "   "})
    assert response.status_code == 422


def test_oversized_text_rejected() -> None:
    response = client.post("/v1/classify", json={"text": "x" * 4001})
    assert response.status_code == 422


def test_unknown_category_rejected() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "hello", "enabled_categories": ["misinformation"]},
    )
    assert response.status_code == 422
