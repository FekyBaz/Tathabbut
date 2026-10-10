import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tathabbut_api.classifier import classify
from tathabbut_api.schemas import ClassifyRequest, ClassifyResponse

app = FastAPI(
    title="Tathabbut API",
    description="Conservative text classification service. This starter does not call an external model.",
    version="0.1.0",
)

_origins = [item.strip() for item in os.getenv("TATHABBUT_ALLOWED_ORIGINS", "").split(",") if item.strip()]
if _origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provider": "local-heuristic"}


@app.post("/v1/classify", response_model=ClassifyResponse)
def classify_text(request: ClassifyRequest) -> ClassifyResponse:
    return classify(request)
