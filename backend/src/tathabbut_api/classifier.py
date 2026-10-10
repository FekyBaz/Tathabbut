import re

from tathabbut_api.schemas import Category, ClassifyRequest, ClassifyResponse, LabelScore

PATTERNS: dict[Category, tuple[re.Pattern[str], ...]] = {
    "harassment": (
        re.compile(r"\b(?:you are|you're) (?:a|an) (?:moron|idiot|loser)\b", re.IGNORECASE),
        re.compile(r"\b(?:shut up|you are pathetic)\b", re.IGNORECASE),
    ),
    "hate": (
        re.compile(r"\b(?:all|every) (?:members of )?(?:group) are (?:vermin|subhuman)\b", re.IGNORECASE),
    ),
    "threats": (
        re.compile(r"\b(?:i will|i'm going to) (?:kill|hurt|attack) you\b", re.IGNORECASE),
        re.compile(r"\b(?:i will|i'm going to) kill (?:him|her|them)\b", re.IGNORECASE),
    ),
    "spam": (
        re.compile(r"\b(?:dm me to claim|guaranteed profit|claim your prize now)\b", re.IGNORECASE),
        re.compile(r"(?:https?://\S+\s*){4,}", re.IGNORECASE),
    ),
}


def classify(request: ClassifyRequest) -> ClassifyResponse:
    """Use conservative rules until an evaluated provider adapter is configured."""
    text = request.text[:4000].strip()
    labels: list[LabelScore] = []
    for category in request.enabled_categories:
        if any(pattern.search(text) for pattern in PATTERNS[category]):
            labels.append(LabelScore(category=category, score=0.90 if category == "threats" else 0.86))
    return ClassifyResponse(labels=labels, provider="local-heuristic")
