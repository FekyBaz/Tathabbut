# Initial threat model

## Assets
User privacy, provider secrets, filtering integrity, browser functionality, and accessible restore controls.

| Threat | Mitigation |
|---|---|
| API key extracted from extension | Keep secrets on the backend |
| Prompt injection in page text | Treat text as data; validate structured output |
| Oversized request | Request length cap; add deployment rate limits and timeouts |
| Invalid classifier response | Strict category and score allowlist |
| False positives | Conservative threshold, settings, restore path, evaluation |
| Facebook DOM changes | Defensive selectors and manual regression tests |
| Unexpected data transfer | Remote API disabled unless configured; send minimal payload |
| Hostile remote response | Never inject response as HTML; use validated fields |

## Out of scope
Compromised browsers/OS, proving truth or intent from text alone, Facebook moderation enforcement, and image/video/private-message filtering.
