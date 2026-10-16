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


def test_classify_arabic_direct_insult() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "إنتَ غَبِي", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_classify_arabic_threat() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "هقتلك", "enabled_categories": ["threats"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "threats"


def test_classify_arabic_spam() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "مبروك كسبت الجائزة", "enabled_categories": ["spam"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "spam"


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


def test_respectful_arabic_criticism_is_not_flagged() -> None:
    response = client.post(
        "/v1/classify",
        json={
            "text": "أنا مختلف مع القرار وأعتقد أنه يحتاج إلى تغيير.",
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


def test_shouty_promo_text_is_not_matched_by_starter_spam_rules() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "FREE FREE FREE CLICK NOW CLICK NOW CLICK NOW", "enabled_categories": ["spam"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"] == []


def test_tatweel_insult_matches_after_normalization() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "\u0627\u0646\u062a \u063a\u0640\u0640\u0628\u0640\u0640\u064a", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_exact_respectful_disagreement_is_not_hidden() -> None:
    response = client.post(
        "/v1/classify",
        json={
            "text": "I respectfully disagree with your opinion.",
            "enabled_categories": ["harassment", "hate", "threats", "spam"],
        },
    )
    assert response.status_code == 200
    assert response.json()["labels"] == []


def test_arabic_future_threat_with_hamza() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "\u0633\u0648\u0641 \u0623\u0642\u062a\u0644\u0643", "enabled_categories": ["threats"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "threats"


def test_bullying_insult_parity_with_extension() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "\u0627\u0646\u062a \u0627\u0647\u0628\u0644", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_mockery_parity_with_extension() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "\u064a\u0627 \u0633\u0644\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0630\u0643\u0627\u0621", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_egyptian_threat_variant_parity() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "\u0639\u0627\u064a\u0632 \u0627\u0642\u062a\u0644\u0643", "enabled_categories": ["threats"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "threats"


def test_parity_harassment_feminine_taa_marbuta() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "انت غبية", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_parity_harassment_ya_jahil() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "يا جاهل", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_parity_mockery_alim_zamanak() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "أنت عالم زمانك", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_parity_mockery_fakir_nafsak() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "انت فاكر نفسك مين؟", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_parity_belittling_malaksh() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "انت مالكش لازمه", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_parity_belittling_mahadesh() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "محدش بياخد بكلامك", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_parity_belittling_akher() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "انت آخر واحد يتكلم", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_parity_belittling_metefhamsh() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "انت متفهمش حاجة", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "harassment"


def test_parity_respectful_egyptian_stays() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "أنا مختلف معاك في الرأي", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"] == []


def test_parity_abstract_failure_stays() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "هذا الفشل في التجربة يحتاج إلى تحليل", "enabled_categories": ["harassment"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"] == []


def test_hate_positive_parity() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "All group are vermin", "enabled_categories": ["hate"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "hate"


def test_group_policy_criticism_is_not_hate() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "I disagree with this group's policy and voted against it.", "enabled_categories": ["hate"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"] == []


def test_english_spam_parity() -> None:
    response = client.post(
        "/v1/classify",
        json={"text": "Claim your prize now, DM me to claim", "enabled_categories": ["spam"]},
    )
    assert response.status_code == 200
    assert response.json()["labels"][0]["category"] == "spam"
