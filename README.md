# Tathabbut (تثبّت)

**A privacy-conscious, open-source text safety filter for social feeds.**

Tathabbut is a browser extension that helps people choose what they see on social media by locally hiding text that matches their own preferences. The first supported site is Facebook. It does not delete posts, change Facebook data, or make moderation decisions on behalf of anyone.

> **Principle:** hide locally, explain clearly, restore anytime.

## Why the name?
**تثبّت** means to verify, be deliberate, and avoid rushing to judgement. The project applies that spirit to online text: evaluate context carefully, make filtering configurable, and avoid treating disagreement or respectful criticism as abuse.

## MVP status
This initial release lays the foundations for:
- A Manifest V3 Chrome extension for Facebook feed text.
- A local reversible hide/restore flow.
- A separately hosted FastAPI classifier API.
- Privacy, security, contribution, and testing documentation.

The starter classifier is deliberately conservative and rule-based. It does not claim to determine truth or intent perfectly. Misinformation filtering is not enabled by default because factual verification needs evidence and provenance.

## Stack
- Extension: TypeScript + Vite + Chrome Manifest V3.
- API: Python 3.11+ + FastAPI.
- Testing: Vitest, pytest, Ruff.
- License: MIT.

## Quick start

### Extension
```bash
cd extension
npm install
npm test
npm run build
```
Open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and select `extension/dist`.

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn tathabbut_api.main:app --reload
```
Health check: `http://127.0.0.1:8000/health`.

## Privacy
- Local classification is the default.
- Remote classification is used only when the user configures an API URL.
- Only the text snippet and selected categories should be sent remotely.
- Provider keys belong on the server, never in extension code.
- The API starter does not log submitted text by design.
- Hidden content remains on Facebook and can be revealed in the browser.

Read [Privacy model](docs/PRIVACY.md), [Threat model](docs/THREAT_MODEL.md), and [Responsible filtering](docs/RESPONSIBLE_FILTERING.md).

## Responsible filtering
A label is a suggestion, not a fact. Quotation, satire, reclaimed language, dialect, counterspeech, and educational discussion can lead to false positives. Tathabbut therefore supports user-controlled categories, a confidence threshold, and reversible hiding. Respectful criticism and disagreement are not violation categories.

## Project structure
- `extension/`: Chrome extension
- `backend/`: FastAPI service
- `docs/`: architecture, privacy, threat model, roadmap
- `.github/`: CI and contribution templates

See [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

The project is inspired by the general value of careful verification. It is not a religious authority and does not enforce religious rules.
