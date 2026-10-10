# Contributing to Tathabbut

Thank you for helping make text filtering more useful, transparent, and fair.

## Before starting
1. Read the README, architecture, privacy model, and responsible filtering principles.
2. Search existing issues before opening a new one.
3. Discuss significant design changes in an issue before implementing them.

## Principles
- Never delete, edit, report, or otherwise mutate social-network content.
- Keep a restore path for hidden content.
- Do not treat respectful disagreement, criticism, quotations, or identity mentions as harmful solely because of keywords.
- Never commit credentials, API keys, private feed dumps, or personal data.
- Keep provider-specific code on the backend.
- Treat page text and model output as untrusted.
- Document false-positive and false-negative trade-offs.

## Development
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
pip install -e ".[dev]"
pytest
ruff check .
```

## Pull requests
- Include tests for changed behavior.
- Explain user-facing and privacy implications.
- Include benign counterexamples for classification changes.
- Do not claim a model detects truth, intent, or context perfectly.
- Keep pull requests focused and reviewable.

## Security reports
Do not publish exploitable vulnerabilities or secrets in a public issue. Use GitHub private vulnerability reporting if enabled, or contact the maintainer privately.
