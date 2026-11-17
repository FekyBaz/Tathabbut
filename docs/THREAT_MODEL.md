# Threat model — local-only Release Candidate

## Assets
User privacy, filtering integrity, browser functionality, settings, and accessible restore controls.

| Threat | Mitigation |
|---|---|
| Extracted content sent to an external classification service | The Stable extension has no remote classifier, external endpoint configuration, background service worker, or optional host permissions. Artifact checks reject network transports and remote-classification markers. |
| Overbroad page access | Static host access is limited to HTTPS Facebook hosts; content selectors operate on visible supported text. |
| False positives or false negatives | Conservative local patterns, user settings, REVIEW behavior, manual reveal, regression tests, and evaluation reports. |
| Facebook DOM changes | Defensive selectors and synthetic fixtures; live compatibility remains unverified until manual browser testing. |
| Settings sync mistaken for content transfer | Only preferences are stored in `chrome.storage.sync`; no extracted comment text is included. Browser Sync may sync those preferences through the user's account. |
| Stale remote setting from older versions | The current local flow ignores legacy API URL fields; the popup removes the field from synced settings and attempts to revoke its saved optional origin permission. |
| Oversized or hostile page content | Text length cap, local parsing/normalization, bounded work queue; no remote parser or service is involved. |

## Out of scope
Compromised browser/OS, normal Facebook and browser traffic, other extensions, proving truth or intent from text alone, Facebook moderation enforcement, and image/video/private-message filtering.
