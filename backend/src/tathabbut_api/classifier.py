import re

from tathabbut_api.schemas import Category, ClassifyRequest, ClassifyResponse, LabelScore

PATTERNS: dict[Category, tuple[re.Pattern[str], ...]] = {
    "harassment": (
        re.compile(r"\b(?:you are|you're) (?:a|an) (?:moron|idiot|loser)\b", re.IGNORECASE),
        re.compile(r"\b(?:shut up|you are pathetic)\b", re.IGNORECASE),
        re.compile(r"(?:^|[\s،,.!?؟])(?:انت|انتي)\s+(?:غبي[هة]?|حمار|فاشل[هة]?)(?=$|[\s،,.!?؟])"),
        re.compile(r"(?:^|[\s،,.!?؟])يا\s+(?:غبي[هة]?|حمار|فاشل[هة]?)(?=$|[\s،,.!?؟])"),
        re.compile(r"(?:^|[\s،,.!?؟])(?:انت|انتي|انتوا|انتم)\s+(?:غبي[هة]?|اهبل|هبل[هة]?|حمار|فاشل[هة]?|تافه[هة]?|حقير[هة]?|جاهل[هة]?)(?=$|[\s،,.!?؟])"),
        re.compile(r"(?:^|[\s،,.!?؟])يا\s+(?:اهبل|هبل[هة]?|متخلف[هة]?|تافه[هة]?|حقير[هة]?|جاهل[هة]?)(?=$|[\s،,.!?؟])"),
        re.compile(r"(?:عبقري\s+زمانك|عالم\s+زمانك|يا\s+سلام\s+علي\s+(?:الفهم|الذكاء)|ما\s+شاء\s+الله\s+علي\s+(?:الفهم|الذكاء)|فاهمه?\s+اوي|فاكر\s+نفسك\s+مين)"),
        re.compile(r"(?:انت\s+مالكش\s+لازم[هة]?|محدش\s+بياخد\s+بكلامك|انت\s+اخر\s+واحد\s+يتكلم|انت\s+متفهمش\s+حاج[هة]?|كلامك\s+يضحك)"),
    ),
    "hate": (
        re.compile(r"\b(?:all|every) (?:members of )?(?:group) are (?:vermin|subhuman)\b", re.IGNORECASE),
    ),
    "threats": (
        re.compile(r"\b(?:i will|i'm going to) (?:kill|hurt|attack) you\b", re.IGNORECASE),
        re.compile(r"\b(?:i will|i'm going to) kill (?:him|her|them)\b", re.IGNORECASE),
        re.compile(r"(?:^|[\s،,.!?؟])(?:هقتلك|هاذيك|هضربك|سوف\s+اقتلك|سوف\s+اذيك|اريد\s+قتلك|عايز\s+اقتلك|عاوز\s+اقتلك)(?=$|[\s،,.!?؟])"),
        re.compile(r"(?:^|[\s،,.!?؟])(?:هقتل|هاذي|هضرب)(?:ه|ها|هم)(?=$|[\s،,.!?؟])"),
    ),
    "spam": (
        re.compile(r"\b(?:dm me to claim|guaranteed profit|claim your prize now)\b", re.IGNORECASE),
        re.compile(r"(?:https?://\S+\s*){4,}", re.IGNORECASE),
        re.compile(r"(?:^|[\s،,.!?؟])(?:ابعتلي خاص عشان تكسب|اربح الجائزة الان|مبروك كسبت الجائزة)(?=$|[\s،,.!?؟])"),
    ),
}


def _normalize_for_rules(text: str) -> str:
    text = text[:4000].strip()
    text = re.sub(r"[\u064b-\u065f\u0670\u0640]", "", text)
    text = re.sub(r"[\u200b-\u200f\u202a-\u202e\u2060\ufeff]", "", text)
    text = re.sub(r"[أإآٱ]", "ا", text)
    return re.sub(r"ى", "ي", re.sub(r"\s+", " ", text))


def classify(request: ClassifyRequest) -> ClassifyResponse:
    """Use conservative rules until an evaluated provider adapter is configured."""
    text = _normalize_for_rules(request.text)
    labels: list[LabelScore] = []
    for category in request.enabled_categories:
        if any(pattern.search(text) for pattern in PATTERNS[category]):
            labels.append(LabelScore(category=category, score=0.90 if category == "threats" else 0.86))
    return ClassifyResponse(labels=labels, provider="local-heuristic")
