# Tathabbut (تثبّت)

**A privacy-conscious open-source text filter for social feeds.**

Tathabbut is a Chrome extension that locally hides text matching user-selected categories. The first target is Facebook. It never deletes posts or modifies Facebook data.

> **Hide locally. Explain clearly. Restore anytime.**

The Arabic name تثبّت conveys careful verification and avoiding hasty judgment. Respectful criticism is not a violation category. The initial classifier uses narrow, deterministic starter rules; it does not establish truth or intent. Misinformation filtering is not enabled by default because verification needs evidence and provenance.

## Current status

The repository contains the initial Chrome Manifest V3 extension, optional FastAPI endpoint, CI tests/build, and project privacy/security documents. This is an early MVP and the Facebook selectors/rules need broader manual and language-aware evaluation before everyday use.

## Get the extension

1. Open the latest successful [GitHub Actions workflow](https://github.com/FekyBaz/Tathabbut/actions/workflows/ci.yml).
2. Open its run and download the `tathabbut-chrome-extension` artifact.
3. Extract the ZIP to a folder.
4. Visit `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the extracted folder.

The artifact is created by CI after tests and package-layout checks pass.

## Run locally

Extension:
```bash
cd extension
npm install
npm test
npm run build
```

API:
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
uvicorn tathabbut_api.main:app --reload
```

Health check: `http://127.0.0.1:8000/health`.

## Categories in the starter
- Personal insults / harassment
- Hateful or dehumanizing attacks
- Threats of violence
- Spam

User controls include enabling/disabling filtering, selecting categories, adjusting confidence threshold, and optionally configuring a self-hosted API URL. Leaving the API blank keeps classification local.

## Privacy and limitations
Provider keys must stay on the backend, never in extension code. Only a selected text snippet and chosen categories should be sent when remote classification is explicitly configured. The backend starter makes no external model calls.

Context matters: quotations, satire, reclaimed language, dialect, counterspeech, or reporting abuse can be misread by classifiers. Filtering is reversible and does not report or delete content. See [privacy](docs/PRIVACY.md), [responsible filtering](docs/RESPONSIBLE_FILTERING.md), and [threat model](docs/THREAT_MODEL.md).

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md), the [roadmap](docs/ROADMAP.md), and issue templates. License: MIT.

The project draws inspiration from the general value of careful verification; it is not a religious authority and does not enforce religious rules.
