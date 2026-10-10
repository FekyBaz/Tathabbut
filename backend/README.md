# Tathabbut API

A FastAPI service for optional remote classification. The initial implementation uses conservative local rules and makes no external model calls.

## Setup
```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn tathabbut_api.main:app --reload
```

Endpoints: `GET /health`, `POST /v1/classify`.

CORS is disabled unless `TATHABBUT_ALLOWED_ORIGINS` is explicitly set to a comma-separated allowlist. The API is not production-hardened: configure TLS, rate limiting, deployment timeouts, and monitoring before exposing it publicly.

No provider SDK is included yet. Add one behind a backend-only adapter, using deployment secrets. Never expose `TATHABBUT_API_KEY` to the extension. Enforce consent, retention disclosure, cost controls, and strict output validation.
