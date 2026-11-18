# Tathabbut local-only release candidate 1

**Prepared:** 2026-11-01 (local workspace time)  
**Source revision:** `75daf7ae3ca46b2bd00fefc63ea832be820cf353` on `fix/dom-reveal-lifecycle`  
**Manifest version:** `0.1.0` (unchanged); artifact label: `rc1`  
**Release status:** local-only candidate for review and controlled browser checks; not a Stable 1.0 release.

## Scope and preserved work

This candidate removes the extension's remote classification path and its settings/UI, permission request flow, background worker, and remote API module. It retains local V7 classification, diagnostic rule evidence, thresholds, category selection, settings, and reversible hide/reveal behavior. Existing user work on V7 remains in the working tree. Backend source was not edited. The four V7 evaluation assets were hash-checked before and after preparation; hashes are recorded in the handoff checklist below. No license file was changed. No commit or push was made.

The existing `docs/STABLE_1_0_READINESS_AUDIT.md` is a historical source audit; its remote-mode findings describe the pre-RC code it inspected. This report describes this local candidate.

## Local operation and package policy

- MV3 permissions: `storage` plus Facebook HTTPS host access only.
- No background worker, optional host permissions, remote classifier endpoint, network client, or remote classification message is packaged.
- Legacy `apiUrl` values are stripped from saved settings when the popup opens. The popup attempts to revoke the corresponding existing optional origin grant and reports if revocation is unsuccessful. It never requests a permission.
- Categories and the 85% starting rule threshold remain unchanged. Rule scores are not calibrated probabilities. A contextual match remains REVIEW/visible.
- The README and privacy notes disclose that preferences use Chrome Sync storage and may sync through the user's browser account. Comment text is not submitted by this package.
- Backend remains in the repository for development; it is not included in the extension ZIP.

## Changes made for this candidate

1. Removed `background.ts`, `remote-api.ts`, their network tests, remote settings controls, remote verdict handling, and optional-origin manifest configuration.
2. Added legacy-setting cleanup and permission revocation tests; added a manifest permission allowlist test and a local-policy behavior baseline test.
3. Updated the synthetic browser harness to work without a background worker and test that a legacy API URL does not result in outbound traffic.
4. Tightened the distribution verifier and made its expected package contents explicit.
5. Added a deterministic ZIP packager. Its ZIP timestamps are fixed; the diagnostic build identifier is explicitly set to `rc1` for this build.
6. Corrected the legacy evaluation test to measure category detection from classifier labels rather than treating contextual REVIEW as a missed category. HIDE/REVIEW policy remains separately tested. This is an evaluation-harness correction, not a change in classifier behavior.

No local rule patterns, thresholds, category policy, DOM selection, mutation handling, or reveal logic were changed in this RC preparation.

## Verification results

| Check | Result | Evidence / limitation |
|---|---|---|
| Extension unit tests | PASS, 399 tests in 19 files | `npm test -- --reporter=dot` |
| TypeScript | PASS | `npm run typecheck` |
| Production build | PASS | `npm run build`, diagnostic build ID `content-rc1` |
| Distribution validation | PASS | Build runs `scripts/verify-dist.mjs`; exact inventory and manifest permissions checked |
| Headed synthetic browser lab | 105/105 scenarios recorded passing | Fixture pages only. The report was overwritten by a later headless attempt; a subsequent headed rerun did not produce a clean command exit. Treat this as scenario-level evidence with a harness shutdown/reporting limitation. |
| Headless synthetic lab | NOT SUPPORTED | Extension harness documents that headless Chromium may not load extensions; attempt failed before scenarios and overwrote its report file. |
| Live Facebook / Chrome / Brave | NOT TESTED | Complete the manual checklist with a non-sensitive test account. |
| Backend tests | PASS, 33 tests | `python -m pytest ../backend/tests -q`; Backend source was not changed. |
| `git diff --check` | PASS | Only Git line-ending conversion warnings were emitted; no whitespace errors remain. |

### Classification evidence retained

This RC does not alter local rule results. The current legacy evaluation corpus now reports detection-label counts: harassment TP/FP/TN/FN `6/1/24/0`, hate `2/0/29/0`, threats `4/0/27/0`, and spam `5/0/26/0` over 31 synthetic items. Those numbers are not estimates of real-world performance; the corpus is small, synthetic, and category coverage is unbalanced. In particular, the hate positives use a placeholder “group” pattern and do not establish coverage for real protected-identity targeting. V2/V3/V4/V5/V7 frozen evaluations remain unchanged, except that the evaluation harness no longer conflates REVIEW with no category detection.

The V7 evaluation files and reports remained byte-for-byte unchanged:

| File | SHA-256 |
|---|---|
| `eval/rule-engine-v7-dev.json` | `4C1BC4F0E776953DCEA9F6B3037ECC7F2D2E000FEB9ECC78F51ED6212A3B2E4D` |
| `eval/rule-engine-v7-test.json` | `713CAE3EF533709E4FB677F059B268AEA9A24A0F254FA06AFC654FFEFA5BA601` |
| `eval/RULE_ENGINE_V7_METHODOLOGY.md` | `61EE9046A96D2FD7323AFFEDA83ACC44BC04B05FDCD42FD2E5DD5E54E84A543D` |
| `eval/RULE_ENGINE_V7_CYCLE_REPORT.md` | `597ABFA33369C9D883F09A19B6025352BA8AE9217D213BA1E7115CCC24FC146D` |

## Artifact handoff

The unpacked directory for local source testing is `extension/dist`. The shareable archive is `release/tathabbut-local-rc1-0.1.0.zip` (26,548 bytes; SHA-256 `98fcf8830b1b9b0b824743c63eb0501f994e04a6b45a47627c09ffbd86bbf171`). The final RC1 build wrote `extension/dist/content.js` at 2026-10-31 22:44:47 UTC; the archive was written at 22:44:49 UTC. The ZIP contains the verified MV3 extension, README, license, privacy/responsible-filtering/threat-model notes, and manual test checklist. The ZIP's checksum and file-by-file byte inventory are in `release/tathabbut-local-rc1-0.1.0.zip.sha256` and `release/INVENTORY.txt`.

To install the ZIP, extract it to a stable folder, then use **Load unpacked** in `brave://extensions/` or `chrome://extensions/` and select the extracted folder containing `manifest.json`. To load the source build, select `extension/dist`. Reload the extension after replacing files. Confirm the extension details page points to the intended folder and inspect the popup; do not infer a successful reload from the build alone.

## Manual browser checklist

| Item | Status |
|---|---|
| Load unpacked in Chrome | NOT TESTED |
| Load unpacked in Brave | NOT TESTED |
| Popup settings and categories | NOT TESTED in a real browser |
| Local classification and reversible reveal on Facebook | NOT TESTED on live Facebook |
| Settings persistence after browser restart | NOT TESTED |
| Long-feed responsiveness and memory | NOT TESTED |
| Live page console and network inspection | NOT TESTED |
| Legacy optional-origin permission cleanup on upgrade | Automated mock test PASS; real browser NOT TESTED |

The synthetic fixture lab is not live-site validation. Record the archive SHA and browser version when these manual checks are performed; do not record real user comment text or identifiers.
