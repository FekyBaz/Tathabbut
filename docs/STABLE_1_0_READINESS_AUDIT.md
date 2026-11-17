# Tathabbut Stable 1.0 Release Readiness Audit

**Audit date:** 2026-11-01  
**Recommendation: NOT READY** for a Stable 1.0 public release. The current source has a substantial working extension and strong automated coverage, but the present branch is not a release candidate: the intended Apache-2.0 decision conflicts with the checked-in MIT license, ownership clearance has not been established, package versions remain `0.1.0`, there is no tagged/reproducible release artifact process, live Facebook behavior has not been verified, and public-facing privacy/security and remote-mode gaps need resolution. This is a release gate assessment, not a request to delay useful work for perfect classification metrics.

This review did not change extension behavior, evaluation data, dependency versions, generated `dist`, or Git history. It preserves the existing uncommitted V7 work. Findings describe the inspected checkout and do not certify live production behavior.

## 1. Repository baseline

- **Branch:** `fix/dom-reveal-lifecycle`
- **HEAD:** `75daf7ae3ca46b2bd00fefc63ea832be820cf353` (`75daf7a`), “feat(extension): add pipeline diagnostics and rule evaluation”.
- **Upstream:** `origin/fix/dom-reveal-lifecycle` points to the same commit. `origin/main` is `97cba12ae0870abbbc17582f75bd0d48025703d5`; current branch is 112 commits ahead of `origin/main`, with main an ancestor. No release tags exist.
- **Working tree:** V7 work remains uncommitted. Modified files: `eval/RULE_ENGINE_EVALUATION.md`, `extension/smoke/lab.py`, and `extension/src/{content.ts,diagnostics.test.ts,diagnostics.ts,harassment.test.ts,i18n.ts,policy.test.ts,policy.ts,popup.test.ts}`. New files: `eval/RULE_ENGINE_V7_CYCLE_REPORT.md`, `eval/RULE_ENGINE_V7_METHODOLOGY.md`, `eval/rule-engine-v7-{dev,test}.json`, and `extension/src/rule-engine-v7-eval.test.ts`.
- **Generated bundle:** `extension/dist` is ignored by Git and was last rebuilt 2026-10-31 21:35 UTC (per filesystem metadata). This audit did not rebuild it. The prior work session ran `npm run build`, `verify-dist`, and the browser fixture lab (105/105 fixtures passed); those results are not live Facebook validation. The current V7 tracked-source edits may post-date that bundle, so do not assume `dist` represents current source.

## 2. Product functionality audit

| Area | Current implementation and evidence | Readiness and limitations |
|---|---|---|
| Content discovery | `extension/src/content.ts` discovers Facebook article/comment units and standalone text, including `ServerTextArea`; selectors and traversal are in the content script. | Implemented. Synthetic fixture coverage exists. Facebook DOM selectors are unstable and actual live-page discovery is unverified. |
| Text extraction | Extracts a bounded text snapshot, removes extension UI/nested units, normalizes text and limits it to 4,000 characters (`content.ts`). | Implemented and tested with fixtures. Platform-specific hidden/duplicated text and long posts need live checks. |
| Normalization and rules | `extension/src/text-engine.ts` and `extension/src/policy.ts` normalize Arabic/Unicode and apply deterministic local rules; V7 changes are in the dirty working tree. | Implemented; synthetic data only supports narrow conclusions. Do not treat rule scores as calibrated probabilities. Hate coverage is especially insufficient: the current rule inventory has one placeholder-style group dehumanization expression and the reviewed V7 set has no clear hate positives. |
| ALLOW / HIDE / REVIEW | Local policy in `policy.ts`; `REVIEW` is surfaced as a diagnostic decision and leaves the item visible. | Implemented locally. There is no review queue or user-facing pending-review workflow. Remote classification uses a legacy score schema and cannot express the same `REVIEW` outcome, so the user experience/policy can diverge when remote mode is enabled. |
| Threshold | Defaults in `policy.ts`; UI threshold is configurable. Defaults enable filtering and categories at 0.85; rule score constants are heuristic routing values (including 0.86 for several categories and 0.90 for threats). | Implemented, but not statistically calibrated. Documentation calling this a “confidence threshold” risks implying probability calibration. |
| Hiding and reveal | Content script applies reversible classes/CSS and reveal controls; it attempts to isolate a matching child target. No content is deleted. | Implemented and unit/fixture tested. Reveal is held in in-memory `WeakMap` state and expires when target content/settings change; it is not durable across page reloads or tabs. |
| Settings and updates | Settings are read from `chrome.storage.sync`, sanitized with defaults, watched for changes, and re-evaluated. Status/diagnostics are written to `chrome.storage.local` (`content.ts`). | Implemented. Docs should explicitly say preferences—including a configured API URL—may sync across signed-in Chrome browsers when browser Sync is enabled. No formal schema migration/version history was found. |
| Queue and failures | Bounded queue uses concurrency 2 and a 200-item pending bound; stale work is guarded; remote errors fall back to local; queue overflow leaves items visible and can retry on subsequent changes. | Safe behavior is implemented and exercised in tests. Live feed load, latency, memory, and long-session backpressure are not measured. |
| Diagnostics | Opt-in metadata diagnostics include counters, text length/fingerprint, rule IDs/reasons; content text, names, and URLs are not intentionally recorded. Status is local storage; lifecycle metadata can be in page localStorage when enabled. | Privacy-conscious implementation, but document storage scope, retention, and the fact that a fingerprint is still derived metadata. Diagnostic code is user-visible/local, not a telemetry service. |
| Optional remote API | Optional user-configured HTTPS endpoint; hostname-based optional permission; request omits credentials, uses no-referrer/no-store and a 5-second timeout. Selected text and enabled categories are sent when the user configures and uses it. Failure falls back locally. | Partially implemented. It is not “fully local” in this mode. URL validation, endpoint trust, transport and transfer disclosure exist, but backend is explicitly a starter and not production hardened. Remote policy differs from current local policy. |

The architecture, threat model, privacy explanation, responsible filtering notes, and manual test procedure are in `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/PRIVACY.md`, `docs/RESPONSIBLE_FILTERING.md`, and `docs/MANUAL_TEST.md`. These documents should be reconciled with the current V7 `REVIEW` behavior and sync semantics before release.

## 3. Balanced behavior and category claims

The defaults favor filtering: enabled by default, all four categories selected, and a threshold of 0.85. Local high-specificity patterns and contextual patterns coexist; review-level contextual outcomes are shown rather than hidden. Users can disable filtering, change categories/threshold, and manually reveal an item. This is a credible reversible baseline, but the “balanced” label is a product description, not a measured precision/recall guarantee.

V7 evaluation currently consists of small single-author synthetic challenge sets (10 development and 10 test items as recorded in `eval/RULE_ENGINE_V7_METHODOLOGY.md`). Label/status corrections occurred after review, including a test-set correction; the set is therefore exploratory rather than independent blinded evaluation. The V7 report records too little clear hate-positive support to estimate hate recall. It does not establish real-world accuracy, nor a plateau. Keep V8 evaluation independent from the release gate, use reviewed labels and a newly locked test split, and report support and limitations. No universal 95% precision gate is recommended.

## 4. Facebook compatibility evidence

- **Synthetic browser fixtures:** previous run reported 105/105 fixture cases passing in `extension/smoke/lab.py` / its report. These exercise a Facebook-like DOM fixture.
- **Automated tests:** the extension suite and build checks below passed in this audit; they verify modeled DOM behavior, not Facebook’s current production DOM.
- **Live Facebook:** no actual logged-in Facebook test was performed or supplied in this audit. Extraction correctness, hide/reveal targeting against current production DOM, scroll behavior, page transitions, and interaction conflicts remain unverified.
- **Performance/long sessions:** no measured CPU, memory, scan latency, queue saturation, or hours-long feed evidence was found.
- **Brave:** no evidence from an actual current Brave session was gathered. Chrome extension compatibility is plausible from MV3 packaging, not a verified claim.

Before stable release, conduct a documented manual pass in supported Chrome and Brave, using self-authored or otherwise consent-safe test content. Verify feed, comments/replies, nested comments, duplicate text, reveal, settings changes, navigation/BFCache, disable/uninstall, and a long-feed session. Record browser versions, extension artifact SHA-256, date, outcomes, and screenshots/logs with personal data removed. Do not represent fixture success as live Facebook compatibility.

## 5. Privacy and security

### Permissions and transfer

`extension/manifest.json` requests `storage` and Facebook host access. It also declares broad optional HTTP/HTTPS host permissions to support arbitrary user-selected endpoints. The UI accepts HTTPS URLs (with loopback development allowance), then asks for the exact endpoint host permission; requests are made only after configuration/use. This is broader than a fixed endpoint but constrained by user choice and URL validation. Explain this clearly in the store listing and permission rationale.

Default classification is local. With optional remote mode configured, selected comment text and enabled category settings go to the user’s configured service. The extension does not attach browser credentials to that fetch. The backend starter in `backend/` does not call an AI provider, but its classification behavior is separate from the extension’s local policy. Backend documentation itself says it is not hardened for public production use; there is no demonstrated public-service authentication/rate limiting, deployment TLS posture, request-log policy, or operational abuse handling. Keep remote API marked as self-hosted/developer functionality until those are addressed, or make the user-facing warning and scope unambiguous.

### Stored data and diagnostics

Settings use `chrome.storage.sync`, which may sync settings to other signed-in Chrome browsers when Chrome Sync is enabled; status uses `chrome.storage.local`. The privacy docs should disclose that distinction, including that a configured API URL is a setting. Diagnostics are opt-in and local, but clarify their retention/deletion behavior and fingerprint semantics. Store-policy disclosures should describe both local processing and the optional user-configured data transfer. See [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage?hl=en) and [Chrome Web Store disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements).

### Dependencies and build supply chain

- `npm audit` reported five advisories in the development dependency graph: two moderate, one high, and two critical (including Vitest/tinypool-related advisories and Vite/undici advisories). `npm audit --omit=dev` reported zero production dependencies/advisories because extension runtime is bundled and has no npm runtime dependencies. Audit details are tool-version/date specific; resolve or explicitly risk-accept the dev toolchain findings before a stable release build.
- GitHub Actions use version tags such as `actions/checkout@v4` and `actions/setup-node@v4`, rather than immutable commit SHAs. Pinning is recommended for supply-chain hardening.
- Backend dependency declarations are ranges and no lockfile was found. `pip-audit` was unavailable in the environment, so Python advisories were not verified. Generate/commit a reproducible backend lock and run an appropriate dependency audit before advertising/deploying the backend.
- Third-party NPM lockfile metadata has license fields for all 144 package entries (MIT is the majority; also Apache-2.0, ISC, BSD, MIT-0, BlueOak, CC0). This is metadata review, not a complete legal compatibility opinion. Review shipped/runtime and backend dependency notices for the actual distribution.

## 6. Apache-2.0 readiness

The user-selected target is Apache-2.0, but the repository currently contains an MIT `LICENSE`; the README also says MIT. All three package manifests (`extension/package.json`, root/backend metadata as applicable, and `backend/pyproject.toml`) report version `0.1.0`. There is no `NOTICE` file.

Do not change the license until the project maintainer confirms the right to relicense every contribution and shipped asset. Git author names/history are not proof of rights. Once cleared, minimum steps are:

1. Add the official Apache License 2.0 text and update all repository/license references consistently; preserve existing attribution and avoid inventing copyright holders.
2. Include the license in the source and packaged extension distribution. Current `extension/scripts/copy-extension-files.mjs` copies the manifest, popup, and CSS, but not `LICENSE`.
3. Add `NOTICE` only if applicable notices need to be carried forward; no current NOTICE was found. Preserve third-party notices where their licenses require it.
4. Add a short Meta/Facebook trademark and non-affiliation statement to the README/store materials; do not imply endorsement.
5. Update README’s “early MVP” and MIT statements for the actual 1.0 product and license.

Consult the [Apache License 2.0 text](https://www.apache.org/licenses/LICENSE-2.0) and its [guidance on applying the license](https://www.apache.org/licenses/LICENSE-2.0.html). This report is not a legal opinion.

## 7. Release engineering and reproducibility

The extension build chain runs TypeScript checking, Vite builds, copies required package files, then runs `extension/scripts/verify-dist.mjs`. The verifier checks the MV3 distribution structure and content-script packaging. CI (`.github/workflows/ci.yml`) runs extension tests/build, browser fixture checks, and backend Ruff/pytest; its uploaded `dist` artifact currently has 14-day retention. This is useful CI evidence, but it is not a versioned public release artifact.

Current release blockers: extension/backend/package versions are `0.1.0`; there is no changelog/release notes, tag, durable release archive, SHA-256 record, or documented rollback/versioned artifact path. `dist` is ignored, and the existing generated folder may lag source. No upgrade/migration matrix was found.

### Verifiable v1.0.0 artifact checklist

- [ ] Resolve Apache-2.0 ownership/attribution clearance; update license, README, and packaged license.
- [ ] Resolve P0 privacy, remote-mode, and live compatibility issues below; document exactly which platforms are supported.
- [ ] Select a reviewed release commit on the intended release branch after preserving and reviewing current V7 changes. Do not tag the present dirty checkout.
- [ ] Set coherent `1.0.0` versions and write release notes with supported browser versions, limitations, permission rationale, privacy/remote-mode description, disable/reveal instructions, and uninstall/rollback procedure.
- [ ] From a clean checkout of the chosen commit, run `npm ci`, extension tests, TypeScript check/build, `verify-dist`, browser fixture suite, backend checks and dependency audit. Record tool versions and commit SHA.
- [ ] Build once in CI or a clean release workspace; package only the validated `extension/dist` contents (plus license/required notices), not the repository or stale local output.
- [ ] Generate SHA-256 for the final archive and retain it with the release tag and artifact. Verify archive contents and load that exact extracted folder in Chrome and Brave.
- [ ] Complete the documented live manual test; publish only evidence-backed compatibility statements.
- [ ] Tag `v1.0.0` only after review and publish the archive/release notes from that exact commit. Keep a known-good prior artifact for rollback.

Chrome’s official [store publishing guide](https://developer.chrome.com/docs/webstore/publish) describes uploading a packaged extension. If distributing outside the store, make the installation source and update mechanism explicit; do not imply store auto-updates.

## 8. Audit validation performed

These results apply to the current dirty checkout on 2026-11-01; they do not replace a clean release-candidate run.

- **Extension tests:** `npm test -- --reporter=dot` — passed, 20 files / 406 tests.
- **Backend tests:** `python -m pytest` — passed, 33 tests.
- **Backend lint:** `ruff check .` — passed.
- **Production build / distribution verification:** not rerun during this audit to avoid overwriting ignored `extension/dist`; previous session reported `npm run build` and `verify-dist` success before/around V7 work. Re-run from clean release commit.
- **TypeScript:** included in the prior build command (`tsc --noEmit`); not independently rerun in this audit.
- **Browser fixture lab:** previous run 105/105 passed; not rerun in this audit.
- **`git diff --check`:** passed in prior V7 work session; run again after any report edit.
- **NPM audit:** full dev graph has five advisories; production-only audit passed with zero production dependencies.
- **Python dependency audit:** not run; `pip-audit` unavailable and no backend lockfile was found.
- **Live Facebook/Brave test:** not run.

## 9. Prioritized backlog

### P0 — required before Stable 1.0

1. **Clear license ownership and align Apache-2.0 distribution.** Confirm contributor/asset rights, then update root license/readme and package the license/required notices.
2. **Resolve what “Stable 1.0” actually ships.** Choose a reviewed release commit/branch, review the 112-commit divergence from main, reconcile the dirty V7 patch set, set consistent `1.0.0` metadata, and create a release tag/archive/hash. Current dirty branch is not a release candidate.
3. **Complete live platform verification and accurately scope support.** Verify actual Chrome and Brave against current Facebook feeds/comments and reversible reveal; record results. Until then no live compatibility claim is justified.
4. **Complete store/privacy disclosure.** State local default processing, optional outbound text transfer, broad optional host permissions, synced settings/API URL, diagnostic data and retention. Verify required store privacy fields before submission.
5. **Constrain or harden remote API for the stated stable product.** Either scope it explicitly to user-operated/self-hosted development, or establish the security/privacy/availability controls for a public service and align its output semantics with local ALLOW/HIDE/REVIEW behavior.

### P1 — strongly recommended before release

1. Address the critical/high/moderate development dependency advisories and pin GitHub Actions to immutable SHAs; rerun tests and audits.
2. Add a backend lockfile and run a Python dependency/security/license audit; do not publish the starter as a production API without operational controls.
3. Reconcile docs with actual `REVIEW`, heuristic threshold, sync storage, reveal lifetime, diagnostics storage, and remote/local differences.
4. Run browser-version, long-feed, performance/backpressure, upgrade, disable, uninstall, and rollback checks on the final artifact.
5. Add a minimal release changelog, artifact inventory/checksum, and support/bug-reporting route.

### P2 — safe to continue after 1.0 or in parallel without changing the release gate

1. Continue V8 independent annotation/evaluation with blinded reviewers if available, exact/near-duplicate integrity checks, and a locked test set. Do not tune against frozen V2–V7 sets.
2. Improve language/category coverage only with reviewed evidence; current hate coverage is not sufficient for a category-level efficacy claim.
3. Expand browser fixture coverage where it represents observed live DOM cases, while keeping fixture and live evidence clearly separated.
4. Consider persistent per-item reveal only if user research shows a need; current in-page reversibility is implemented and avoids stale persisted decisions.

## 10. Final recommendation

**NOT READY for Stable 1.0 today.** The extension is a functioning, reversible MV3 prototype with strong automated checks and a useful local-first default. That is not enough to support a stable public release claim while licensing is inconsistent, rights are unverified, the release artifact/version/tag path is absent, actual Facebook/Brave behavior is untested, and the optional remote path is not production-hardened or semantically aligned with local decisions.

This is not a recommendation to wait for perfect moderation coverage. A practical Stable 1.0 can ship with explicitly scoped platform support, transparent privacy and limitations, local filtering as the supported mode, a reproducible artifact, and category claims limited to evidence. Hate effectiveness and wider language coverage should remain evaluation workstreams unless independently reviewed evidence supports stronger claims. No plateau is demonstrated, and no real-world accuracy is claimed.
