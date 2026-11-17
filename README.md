# Tathabbut (تثبّت)

**A privacy-conscious, reversible text filter for Facebook feeds.**

Tathabbut applies its deterministic rules inside the browser. The local Release Candidate has no Backend dependency, remote classification setting, or content-transmission path. It never deletes posts, reports people, or modifies Facebook data. Hide an item and reveal it again from the same page.

> **Hide locally. Explain clearly. Restore anytime.**

The Arabic name تثبّت conveys careful verification and avoiding hasty judgment. Respectful criticism is not a violation category. The rules are narrow starter patterns; they do not establish truth, intent, or broad understanding of Arabic dialects.

## Release Candidate status

This is the local-only RC, manifest version **0.1.0**. Automated tests and synthetic browser fixtures do not verify Facebook’s current live DOM. Chrome, Brave, and live Facebook behavior have not been confirmed for this artifact; see [the manual test checklist](docs/MANUAL_TEST.md).

## Install the unpacked extension

1. Build the extension using the instructions below, or extract the shared ZIP to a folder.
2. Open `chrome://extensions/` in Chrome or `brave://extensions/` in Brave.
3. Turn on **Developer mode**, click **Load unpacked**, and select the extracted package folder. For a source checkout, select `extension/dist`.
4. Enable Tathabbut and open its popup to review the current settings.

The extension declares `storage` for preferences and diagnostics and Facebook-only host access for its content script. It does not request optional HTTP/HTTPS origins or install a background service worker.

## Local behavior and privacy

- Classification is performed locally in the extension.
- No Backend setup is needed or bundled.
- There is no remote classification API configuration in this release.
- The extension does not send extracted comment/post text to a classification service.
- Settings are stored with Chrome Sync storage and may sync through the user's browser account when sync is enabled. This is preference synchronization, not comment-text transfer.
- Diagnostics are opt-in metadata stored locally. No analytics or telemetry service is included.

See [privacy](docs/PRIVACY.md), [responsible filtering](docs/RESPONSIBLE_FILTERING.md), and the [threat model](docs/THREAT_MODEL.md).

## Defaults and limitations

Filtering starts enabled, with harassment, hate, threats, and spam selected and a rule-strength threshold of 85%. These values are not calibrated probabilities. Contextual or low-strength signals remain visible for review. Hidden items can be revealed; reveal state lasts only in the current page context and can reset after text or settings changes or a reload.

The extension targets Facebook HTTPS hosts (`facebook.com` and its subdomains). It does not filter private messages, images, video, or content outside supported text units. Facebook may change its DOM at any time. Do not treat synthetic fixture results as live compatibility evidence.

## Build and test from source

```bash
cd extension
npm ci
npm test
npm run typecheck
npm run build
python smoke/lab.py
```

The build runs the MV3 packaging and local-only artifact checks. The synthetic browser lab does not sign in to Facebook or verify a real feed.

## Development-only diagnostics

The popup's opt-in diagnostics show counts, lengths, fingerprints, and reasons, not post text, names, or URLs. For lifecycle troubleshooting only, see the development procedure in [docs/MANUAL_TEST.md](docs/MANUAL_TEST.md).

## Experimental Backend source

The repository retains a separate FastAPI Backend for developer experimentation. It is not required by this Release Candidate, is not included in the extension ZIP, and is not exposed in the Stable extension UI. Do not use it as part of local-only release validation.

## Project information

See [LICENSE](LICENSE) (MIT, as currently applicable). Tathabbut is not a religious authority and does not enforce religious rules.
