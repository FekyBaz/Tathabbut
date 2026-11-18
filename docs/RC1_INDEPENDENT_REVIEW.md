# Tathabbut RC1 — Independent Release Review

**Review date:** 2026-11-01  
**Scope:** Read-only review of the prepared local-only RC1 package and working-tree evidence. No source, test, evaluation, dist, archive, or Git history was changed for this review.  
**Recommendation: ACCEPT WITH CONDITIONS** for manual browser testing. This is not a Stable 1.0 approval.

## Findings at a glance

| Severity | Finding |
|---|---|
| BLOCKER | None found in the inspected archive. |
| WARNING | The retained smoke report has zero scenarios and records a headless navigation error. The separate 105/105 claim is not verifiable from the current report artifact, and a clean headed exit is not evidenced. |
| WARNING | The legacy evaluation test changed from measuring policy HIDE decisions to measuring category-label detection. Its new figures are not comparable to the old figures or prior reports using that test. |
| WARNING | The baseline test asserts current local outputs; it is not itself a saved before/after execution record. A pre-RC ignored dist snapshot supports preservation of contextual policy behavior, but it is not a source revision or full release baseline. |
| INFORMATIONAL | The package retains manifest version 0.1.0 and is labelled RC1 in the archive name/build identifier. It is not a Stable 1.0 release. |

## 1. Release artifact integrity

I inspected `release/tathabbut-local-rc1-0.1.0.zip` directly.

- Recalculated SHA-256: `98fcf8830b1b9b0b824743c63eb0501f994e04a6b45a47627c09ffbd86bbf171`.
- This exactly matches the checksum in `release/tathabbut-local-rc1-0.1.0.zip.sha256` and the value reported in `release/INVENTORY.txt` and the RC1 report.
- ZIP CRC/integrity check passed. The archive contains 11 files. Actual names and byte sizes exactly match `release/INVENTORY.txt`:

| Path | Bytes |
|---|---:|
| `LICENSE` | 1,100 |
| `README.md` | 4,010 |
| `content.css` | 1,228 |
| `content.js` | 33,416 |
| `docs/MANUAL_TEST.md` | 2,598 |
| `docs/PRIVACY.md` | 2,606 |
| `docs/RESPONSIBLE_FILTERING.md` | 1,341 |
| `docs/THREAT_MODEL.md` | 1,693 |
| `manifest.json` | 595 |
| `popup.html` | 3,346 |
| `popup.js` | 14,268 |

The packaged manifest is valid JSON and declares Manifest V3, `permissions: ["storage"]`, and only the Facebook HTTPS host patterns `https://*.facebook.com/*` and `https://facebook.com/*`. It has no `optional_host_permissions`, `optional_permissions`, or `background` service worker. The ZIP contains no `remote-api`/background implementation files and no Backend source. The content script and popup are the expected files, and the inventory contains no unexpected entries.

I scanned both packaged JavaScript files for the remote classification message, `/v1/classify`, `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `chrome.runtime.sendMessage`, and `chrome.permissions.request`; none were present. This is evidence about the inspected package, not a claim about browser traffic from other software or from Facebook itself.

## 2. V7 preservation and local policy behavior

### What belongs to V7 local classification

The current uncommitted policy diff includes V7 work such as rule specificity (`high` versus `contextual`), the `ALLOW`/`HIDE`/`REVIEW` decision model, category evidence and rule IDs, conservative handling of contextual mockery/spam/placeholder hate, sentence-scoped reporting cues, and the associated diagnostics. Those changes are present in the working tree and should not be attributed to the RC1 transport removal alone.

The pre-RC ignored `dist` snapshot at `C:\Users\laphouse\AppData\Local\Temp\tathabbut-dist-before-rc1-20261101-003753` contains both the remote message path and the same contextual-policy reason/specificity structure. Comparing its minified local decision function with the RC1 bundle shows the same key branches: above-threshold high-specificity evidence yields HIDE; otherwise eligible contextual evidence yields REVIEW. The new bundle no longer contains the remote message path. This supports that the core V7 decision path predated removal, though the ignored snapshot is not a source-controlled, reproducible source checkpoint and cannot prove every output across all input cases.

### What RC1 removed

The reviewed source diff removes the `apiUrl` settings field and remote validator, the popup API URL control and optional permission request flow, content-script `chrome.runtime.sendMessage` classification, background-worker handling, and the remote API module/tests. The manifest loses its background worker and optional host permissions. `decidePolicy` now requires local provider identity and a `matches` array; input failing those local-evidence checks returns ALLOW. This is a guard against externally supplied/legacy result objects.

### ALLOW/HIDE/REVIEW, thresholds, scores, attribution, diagnostics

- The current policy still emits ALLOW for no match/disabled filtering, HIDE for eligible high-specificity matches at or above threshold, and REVIEW for eligible contextual matches or below-threshold scores. `shouldHide` hides only when `decidePolicy` returns HIDE.
- The classifier's local routing scores remain 0.86 for non-threat categories and 0.90 for threats. The default threshold remains 0.85; the boundary is inclusive. The baseline expects a direct insult to HIDE at 0.85 and 0.86, and become REVIEW at 0.87.
- Sentence-scoped reporting and later authored attacks remain represented in the current source and the baseline cases. Diagnostics still include local rule IDs and reasons; the remote/local mode field was removed, and contextual REVIEW has a reason string.
- Compared with committed HEAD, the local policy API and semantics do differ materially: HEAD's `shouldHide` was a score/threshold boolean, while current code has specificity-aware REVIEW behavior. That is V7 policy work in the working diff, not evidence that RC1's remote-path deletion itself changed the pre-existing V7 local branch.

The new `local-policy-baseline.test.ts` is useful as a golden set for the present implementation: it covers no-match ALLOW, explicit insult HIDE, contextual mockery REVIEW, 0.85/0.86/0.87 thresholds, multiple categories, and sentence-level reporting. However, each expected value is asserted by invoking the current implementation. It does not contain a captured pre-removal result or compare two implementations. The report's statement that those cases are “preserved” is stronger than this test alone establishes. The old ignored bundle provides limited corroboration for shared policy branches, not a complete before/after equivalence test.

V7 dev/test JSON and V7 methodology/report files remain byte-identical to the hashes listed in the RC1 report. The V7 evaluation assets themselves were not rewritten for RC1.

## 3. Evaluation harness correction

The exact diff in `extension/src/eval.test.ts` changes `predictedCategories`:

- **Before:** for each category, it called `shouldHide` on that category's score label and a provider value, so a prediction meant the policy would HIDE that category at the configured threshold.
- **After:** it checks whether `classifyLocally` emitted a label for that category. A prediction now means the classifier detected the category, regardless of whether policy would HIDE or REVIEW.

This is a metric-definition change from **policy action** to **category detection**. It fixes the conceptual mismatch where contextual REVIEW was counted as a category false negative, but it also changes the evaluation contract and makes old and new numbers from this test non-comparable. The V7 frozen JSON files were not changed; their hashes match the RC1 report. The legacy `eval/dataset.json` also remains the input, while its test harness changed.

The new values can be compared with other category-detection results only if they use the same labels, corpus, threshold-independent label definition, and category support. They cannot be compared directly with previous HIDE-policy metrics. Neither measure estimates real-world accuracy: this is a small synthetic corpus with sparse and uneven category coverage.

## 4. Privacy and legacy settings

The inspected package has no extension-initiated transport or remote-classification message in its shipped JavaScript. The content script classifies locally. The manifest exposes only storage and Facebook hosts. The remote API implementation and Backend are absent from the archive.

The popup reads prior synchronized settings through a whitelist (`enabled`, enabled categories, threshold, language). If `apiUrl` exists, it writes the sanitized settings back, then derives the old origin and calls `chrome.permissions.contains`/`remove`; it does not call `permissions.request`. A malformed or unsupported legacy value is still excluded from the sanitized settings. If permission removal fails, the status reports that failure; the package has no remote classifier capable of using the retained grant, so failed removal does not reactivate remote classification. The actual cleanup result still needs confirmation in a real browser upgrade test.

The README and privacy document accurately say preferences use `chrome.storage.sync` and may sync via the user's browser account when Sync is enabled, and distinguish preferences from comment text. That disclosure is visible in the shipped README/privacy files. Source inspection and package inspection support the no-Tathabbut-text-transport claim; only a real-browser network inspection can confirm the running installation and observe actual extension behavior in situ.

## 5. Smoke-test evidence

The persisted `extension/smoke/lab-report.json` is **not** a 105/105 report. It records `headless: true`, `scenarios: []`, no summary, and an infrastructure error at `page.goto("chrome://extensions/")` with `net::ERR_INVALID_URL`. Therefore, the currently retained file documents zero completed scenarios.

The RC1 report states that a headed run recorded 105/105 and that a later headless attempt overwrote the report. That 105/105 claim cannot be independently verified from the file now present. Earlier conversation output is not a durable test artifact. During this review, I did not rerun the harness, as requested.

The harness now looks for the extension ID by opening `chrome://extensions/` and inspecting Chromium's shadow DOM, then uses the popup page to access storage in place of the removed service worker. The retained headless failure is consistent with the harness's own warning that headless Chromium may not load extensions. The cause of the headed process not exiting cleanly is **not established** by a retained stack trace or exit code. The current report cannot show whether the headed run completed all scenarios, and the current harness has not demonstrated a clean, reproducible exit in retained evidence. Treat synthetic smoke status as unverified until a future run produces a complete report and clean exit status.

## 6. Remaining manual browser checks

Run these against the exact archive whose SHA is recorded above, and record browser/version, package path, and PASS / FAIL / NOT TESTED without collecting real comment text or user identifiers:

1. Extract the ZIP and load the folder containing `manifest.json` in Brave; repeat in Chrome if both are target browsers. Confirm the extension details page points at that extracted folder and reports no manifest/script errors.
2. Inspect the popup: no API URL control, expected categories/threshold, and Arabic/English text and direction.
3. Upgrade a profile with a legacy `apiUrl` and optional origin grant. Confirm the setting is removed, the permission cleanup result is reported accurately, and filtering still runs locally if permission removal fails.
4. Confirm a benign example stays visible, a documented high-specificity local example hides, an ambiguous contextual example remains visible, and reveal restores the same item.
5. Change categories/threshold and confirm the effect; restart the browser and check settings persistence. Remember synced preferences may propagate through the user's browser account.
6. Enable diagnostics and verify counts/reasons update without comment text or author names; disable diagnostics afterward.
7. Inspect the page console and browser network panel for Tathabbut-originated requests while using a safe test feed. Observe long-feed responsiveness separately.
8. Record live Facebook compatibility as NOT TESTED unless the checks are actually completed on a controlled logged-in profile. Synthetic fixtures do not substitute for this.

## Final recommendation

**ACCEPT WITH CONDITIONS** for manual browser testing. The actual archive checksum, contents, manifest scope, and absence of remote transport were independently verified, and no blocker was found in the packaged artifact. Before relying on the smoke result or longitudinal evaluation figures, retain a clean, complete headed smoke report and label the old/new evaluation metrics as different measures. The current evidence does not establish live browser/Facebook behavior, complete before/after equivalence for every V7 input, or Stable 1.0 readiness.
