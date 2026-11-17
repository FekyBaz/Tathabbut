# Ownership and Licensing Audit

**Audit date:** 2026-11-01  
**Scope:** Ownership, license history, contribution terms, trademark, and proposed local-only Stable 1.0 distribution.  
**Decision:** The repository can potentially move future releases to PolyForm Noncommercial 1.0.0 and preserve a separately granted commercial licensing option, but the evidence is not sufficient to perform that migration safely today. Do not replace the existing MIT license until ownership of all included material and permissions for any third-party contributions are established. Stable 1.0 can be scoped to local classification, but the current extension still exposes and implements optional remote classification and requests broad optional HTTP/HTTPS origins.

This is an evidence audit, not legal advice. Git metadata and repository inspection do not establish copyright title. No legal file, source behavior, branch, history, or V7 data was changed in this audit.

## 1. Executive assessment

The public Git repository contains an MIT license from the initial project commits through current branches. The remote exposes `main`, `fix/dom-reveal-lifecycle`, and `feat/text-filter-engine`; there are no Git tags and GitHub reports no published releases. This is evidence that project source was publicly available under MIT, but it does not establish whether a separate ZIP, browser-store package, or other artifact was distributed or downloaded.

All 160 recorded commits use three author identities that appear associated with the same GitHub username (`FekyBaz` / the `97516177+FekyBaz` noreply address). This is useful provenance evidence, not proof that a single legal person owns every contribution. An uncommitted V7 patch set is present in the checkout and has no committed author attribution. No CLA, DCO process, third-party source notice, or tracked icon/logo asset was found. Dataset and experiment provenance is mixed: the MARBERT experiment names its upstream model and says its evaluation set is synthetic, but no complete file-by-file rights inventory exists.

PolyForm Noncommercial 1.0.0 permits noncommercial use, modification, and redistribution subject to its terms and notice requirements. It restricts commercial-purpose use and is not an OSI Open Source license. It includes a licensor patent grant and a patent-defense termination provision; it prohibits licensees from sublicensing/transferring their licenses. Maintainer-controlled commercial licensing of future releases is feasible only for rights the maintainer owns or has explicitly obtained, including through an appropriately reviewed contributor agreement. A DCO alone is insufficient for that broader relicensing authority.

For a local-only Stable 1.0, the current `extension/dist` build does not include the backend directory, but the extension itself includes a remote UI, a background fetch path, API URL settings, and `optional_host_permissions` for every HTTP/HTTPS origin. Simply omitting the backend is not enough. The release implementation should remove the remote feature from the Stable 1.0 extension package and test that no content text can leave the browser, while retaining backend source in the repository as separate experimental/developer code if desired.

## 2. Repository baseline and contribution ownership inventory

### Git evidence

- **Branch and commit:** `fix/dom-reveal-lifecycle` at `75daf7ae3ca46b2bd00fefc63ea832be820cf353`; upstream `origin/fix/dom-reveal-lifecycle` is the same commit.
- **Remote branches:** `main` at `97cba12ae0870abbbc17582f75bd0d48025703d5`, `feat/text-filter-engine` at `bc1823d367100bf8e69e4282f7b1b5bfecf8d1c6`, and the current fix branch. Current HEAD is 112 commits beyond `origin/main` (`git rev-list --left-right --count origin/main...HEAD` => `0 112`).
- **Tags/releases:** `git ls-remote --tags origin` returned no tags; GitHub Releases API returned zero releases. These observations do not rule out other distribution channels.
- **Recorded author identities:** `git shortlog -sne --all` shows 126 commits by `Mohamed Elfeky <97516177+FekyBaz@users.noreply.github.com>`, 33 by `FekyBaz <fekybaz@gmail.com>`, and 1 by `FekyBaz <FekyBaz@users.noreply.github.com>`. GitHub-style noreply identity and username suggest an account association. They do not verify the legal identity, employment/assignment status, or copyright ownership of the person who made the work.
- **License introduction:** commit `888e9c3` (“chore: add MIT license”, 2026-10-10) adds the MIT license. Initial project documentation is in `b14c483`; repository history from these commits is the earliest inspected history, not proof that no prior code existed elsewhere.
- **Remote refs and working tree:** current branch tracks the same remote SHA. The current V7 changes are uncommitted: modifications in `eval/RULE_ENGINE_EVALUATION.md`, `extension/smoke/lab.py`, and `extension/src/{content.ts,diagnostics.test.ts,diagnostics.ts,harassment.test.ts,i18n.ts,policy.test.ts,policy.ts,popup.test.ts}`; untracked `eval/RULE_ENGINE_V7_CYCLE_REPORT.md`, `eval/RULE_ENGINE_V7_METHODOLOGY.md`, `eval/rule-engine-v7-{dev,test}.json`, and `extension/src/rule-engine-v7-eval.test.ts`. These changes were preserved. Their legal author/ownership status cannot be established from Git because they are not committed.

### File and material inventory

| Material | Evidence and likely provenance | Ownership status / action |
|---|---|---|
| Extension TypeScript, popup, CSS, tests, build scripts | History includes feature commits for the extension, e.g. `afeb44f` (reversible filtering), `0dc4387` (content discovery), `4320b34` (permissioned remote routing), and later rule/lifecycle work. Recorded Git authors are the identities above. | **Authorship evidence only.** Maintainer must confirm who wrote each contribution, whether any work was made for an employer/client, and whether any copied snippets exist. |
| Backend package and tests | Added in commits including `c825655`, `83c324f`, and `9cabc79`; same recorded author identities. | **Authorship evidence only.** No separate contributor/assignment records checked. Backend is intended to remain outside the Stable 1.0 browser package. |
| Evaluation corpora and V7 datasets | Tracked under `eval/`, `extension/src/*eval*`, and current dirty V7 files. V7 methodology describes small single-author synthetic examples; other corpora have their own reports/methods. | Synthetic wording does not establish who authored every example or whether quoted real content exists. Review corpora and annotation/source notes before relicensing or packaging. V7 remains uncommitted and must be preserved. |
| MARBERT experiment | `experiments/arabic-classifier/README.md` identifies `IbrahimAmin/marbertv2-finetuned-egyptian-hate-speech-classification`, a revision, and states weights stay in a local Hugging Face cache and are not in Git. The experiment is labeled evaluation-only. | **Upstream model is referenced, not included in the tracked tree per the experiment docs.** Verify that no weights or copied model code are included in any future archive; separately check the upstream model/dataset terms before redistributing their artifacts. |
| Smoke fixtures and screenshots | `extension/smoke/fixture.html`, `scenarios.html`, Python harnesses are tracked. A failing screenshot exists only as ignored local output under `extension/smoke/artifacts/`. | Fixture authorship follows repository history only; inspect embedded text/image sources if packaging them. Ignored screenshots are not part of the tracked release source and should not be included automatically. |
| Third-party code/assets | No tracked logo/icon/font/image asset, `NOTICE`, vendor directory, copied source attribution, or third-party source license file was found outside `node_modules`. The package lock covers development dependencies, not code shipped as vendored source. | **Not a complete provenance proof.** Run source/license scanning and review historical imports/snippets and any future artwork before a public relicensing. Retain third-party notices required by their own licenses. |
| Project name and identity | Name appears in README, manifest, docs and UI. No tracked logo asset or trademark policy/registration evidence was found. | Separate trademark and copyright from software licensing. Do not claim the name/logo is registered. Decide who controls project identity and who can approve its use. |

No non-FekyBaz Git author identity appears in the inspected commit history. This does **not** prove there are no external contributions: pull-request patches, copied code, private branches, employer-owned work, AI-assisted work, and unrecorded design/data sources require maintainer review. Git author attribution is never treated here as proof of title.

## 3. Existing MIT license and public availability implications

`LICENSE` contains the standard MIT grant, including rights to use, copy, modify, merge, publish, distribute, sublicense, and sell, subject to preserving the copyright and permission notice. It says `Copyright (c) 2026 Tathabbut contributors`. README identifies the project as “open-source” and says `License: MIT` (`README.md`); no other project license file or `NOTICE` exists.

The public remote has branches containing the shared history where `LICENSE` was introduced. Thus source in those commits was made publicly available with an MIT grant. No Git tags or GitHub releases were found, so no versioned release package is evidenced in those channels. The exact set of external copies/downloads and whether an unpacked extension was separately distributed cannot be established from repository metadata.

A future license change can set terms for future releases and for newly authored material the maintainer is authorized to license. It does not retroactively remove the MIT permissions already granted to recipients of copies bearing that license. Existing recipients may continue using, modifying, and redistributing those MIT-licensed versions under the MIT conditions. A new release may have different terms for its new/copyrightable contents, but whether the entire modified work can be relicensed depends on ownership and permissions for every incorporated contribution and component. Keep old MIT releases/notices identifiable; do not replace the terms in a way that suggests old copies lost their grant. Seek counsel on mixed-version notices, branches, and downstream forks.

**Verified:** MIT text is in current tree and in public branch history from commit `888e9c3`; public branches exist.  
**Not verified:** binary/extension-store distribution, download counts, every downstream copy, sole ownership, and rights in all embedded data/code.

## 4. PolyForm Noncommercial 1.0.0 assessment

Use the official, unmodified text from [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). The audit reviewed that text and the PolyForm project's [license overview](https://polyformproject.org/licenses) and [adoption guidance](https://polyformproject.org/why-adopt-polyform).

- **Personal use:** expressly includes research, experiment/testing for public knowledge, study, private entertainment, hobbies, amateur pursuits, and religious observance when there is no anticipated commercial application.
- **Noncommercial redistribution and modification:** allowed for permitted purposes; copies/derivatives must follow the license and recipients must receive the license text or its URL and any licensor-supplied plain-text `Required Notice:` lines. No such Required Notice line was found in the current MIT license; do not invent one. Provide the official license verbatim with source/binary distributions.
- **Organizations:** charitable organizations, educational institutions, public research, public safety/health, environmental protection, and government institutions are listed as permitted regardless of funding source or funding obligations.
- **Commercial use:** not permitted by this license. The proposed “commercial use requires separate permission” policy is compatible with offering a separate commercial agreement only if the licensor actually controls the rights needed for that agreement. PolyForm’s own adoption guidance notes that Noncommercial may suit licensors reserving commercial licenses.
- **Patent provisions:** licensor grants a patent license for claims it can license that would be infringed by use; a written patent-infringement claim against the software triggers termination of the patent license under the text. This is not a broad assurance that every contributor has or grants patent rights.
- **No sublicensing/transfer:** a licensee cannot sublicense or transfer its PolyForm license. This does not itself grant the project maintainer rights to sublicense contributors’ copyrighted contributions under a different commercial license; obtain those rights independently in a contributor agreement.
- **OSI status:** PolyForm Noncommercial restricts commercial fields/purposes. The [Open Source Definition](https://opensource.org/osd) says a qualifying license must not restrict use in a field of endeavor, including business (criterion 6). Describe Tathabbut as **source-available**, not “open source,” if this is the selected license. Update README and other marketing/docs consistently after approval.
- **Ambiguous cases for counsel/FAQ:** use by a for-profit employer for internal moderation; contractor use on behalf of a commercial client; use in an ad-supported or monetized browser profile; a nonprofit’s fee-based service; research sponsored by a company; distributing modified copies inside a business; and whether any particular deployment has an anticipated commercial application. The license includes examples but project-specific facts can matter.

This is a plain-language summary, not a substitute for the official terms. Do not edit the official text to explain these cases; put any project explanation in a separate FAQ reviewed by counsel.

## 5. CLA versus DCO and commercial relicensing feasibility

`CONTRIBUTING.md` describes principles, tests, privacy, and pull-request expectations, but has no CLA/DCO sign-off, copyright grant, or commercial relicensing clause. No `CLA` or `DCO` file/configuration was found.

A DCO is a certificate that a contributor has the right to submit a contribution under the indicated project license and understands the contribution is public; it is not a copyright assignment and does not, by itself, grant the maintainer a separate right to relicense that contribution under future proprietary/commercial terms. See the [DCO 1.1 text](https://developercertificate.org/).

A counsel-reviewed **non-exclusive CLA** can preserve contributor copyright while granting the project maintainer the necessary rights. At a minimum, the agreement should clearly explain before submission and obtain:

1. Contributor identity and a representation that the contributor has the right to submit the contribution, including relevant employer/contractor approvals and third-party license compatibility.
2. A perpetual, worldwide, non-exclusive, irrevocable (subject to the agreement’s legal terms), royalty-free copyright license to reproduce, prepare derivative works, publicly display/perform, distribute, and otherwise use the contribution in source and binary forms.
3. Explicit authority to sublicense and to offer/distribute the contribution as part of the project under the current noncommercial license **and** under other terms chosen by the maintainer, including separate commercial/proprietary licenses.
4. An express statement that the contributor retains copyright ownership and is not assigning ownership; explain any attribution/notice handling.
5. A clearly scoped patent grant for contributor-controlled claims, if intended, with termination and patent-assertion terms reviewed by counsel.
6. How the agreement applies to prior contributions (only if the contributor affirmatively signs it); how future pull requests are covered; and what happens if a contribution is rejected or withdrawn.
7. Contact, privacy, records retention, governing law/dispute terms, and an accessible copy/version of the agreement.

A CLA does not cure code the contributor did not own or have authority to license. Maintain a per-contribution provenance record and do not accept third-party code unless compatible permission is documented. A CLA should be accepted and recorded before merging, not added retroactively without contributor assent.

**Feasibility:** If the maintainer can establish ownership of existing code and receives the required explicit license grants for accepted contributions, separate commercial licensing can be feasible without taking copyright away from contributors. The current repository evidence alone does not establish that prerequisite. If future contributions are accepted only under PolyForm without a commercial relicensing CLA, the maintainer may lack rights to offer those contributions under different commercial terms. Obtain legal review of both the CLA and project license workflow before opening contributions under the new model.

## 6. Trademark, attribution, and identity

No `TRADEMARKS.md`, trademark registration evidence, or tracked logo/icon asset was found. The existing `LICENSE` copyright notice says “Tathabbut contributors”; Git history contains the author labels listed above, but neither identifies a confirmed legal licensor.

Recommended separate `TRADEMARKS.md` policy (not drafted/implemented here):

- State who controls the Tathabbut name, Arabic name, domain, and any future logos; do not claim registration absent evidence.
- Permit truthful nominative references to identify compatibility while reserving use of the name/logo for forks, modified products, endorsements, and commercial offerings.
- Explain that software license permission does not grant trademark rights.
- Include a clear Meta/Facebook non-affiliation statement where the extension is listed or distributed; those marks belong to their respective owners.
- Define how derivative forks should rename themselves and where the policy applies to package IDs/store listings.

Before choosing any copyright notice, ask the maintainer to confirm the legal licensor name/entity and year convention. Do not substitute an individual’s name, company, or “contributors” phrase based only on Git metadata.

## 7. Stable 1.0 local-only distribution scope

### Current behavior and scope gap

- `extension/manifest.json` declares `optional_host_permissions: ["http://*/*", "https://*/*"]`, plus Facebook host permissions and a `background.service_worker` entry.
- `extension/src/popup.html` exposes an API URL field; `extension/src/popup.ts` requests optional origin permission and saves `apiUrl` in Chrome sync settings.
- `extension/src/content.ts` sends extracted text to the service worker when `apiUrl` is configured; `extension/src/background.ts` performs a `fetch` to `/v1/classify` after validating URL and permission. The body contains the selected text and enabled categories.
- `extension/src/policy.ts` includes `apiUrl` in settings. `extension/vite.config.ts` builds `background.js`; the manifest loads it. `extension/src/remote-api.ts` is the URL/permission helper.
- `backend/` is separate in the repository and is not copied into `extension/dist` by `extension/scripts/copy-extension-files.mjs`. That keeps backend source out of the unpacked extension artifact today, but the extension still has a remote API feature.
- The only extension network `fetch` found in `extension/src` is in `background.ts`; no second outbound comment-text path was identified in the inspected sources.

### Minimum local-only Stable 1.0 work (planning only)

1. Remove remote API controls and status claims from the Stable 1.0 popup and localization strings; remove the remote branch from content classification and the remote API URL from release settings/schema. Decide a safe migration for existing stored API URLs so users do not assume they still work.
2. Remove `optional_host_permissions` from the Stable manifest and release artifact. Remove the background service worker if it has no remaining local purpose; it currently exists for remote fetch only. Remove the remote build input/helper from the Stable package as applicable. Keep the backend source in the repository under a plainly marked experimental/developer scope; do not delete it.
3. Ensure Stable 1.0 artifact does not include remote API code/configuration or broad optional HTTP/HTTPS permissions. Preserve only Facebook host access plus necessary storage permission. Make the release manifest/verifier assert the permission and file allowlist.
4. Add regression coverage that local classification does not call `fetch`, send text through runtime messaging, request optional origins, or include API URL UI/settings; verify the packaged artifact’s manifest and file inventory. Do not alter classification patterns or decisions as part of this scope change.
5. Update README, privacy docs, backend docs, store listing, and installation instructions to state local classification is the supported 1.0 mode; no backend is required; no comment text is transmitted by the extension. Separately disclose Chrome `storage.sync` settings behavior: preferences may sync through the user’s browser account when sync is enabled, but that is distinct from comment-text transfer.
6. Keep backend development instructions available only as a separate, clearly labeled experimental service. Avoid packaging backend dependencies, deployment instructions, or API configuration into the Stable 1.0 user flow.

This is a minimum change plan, not implementation authorization. Confirm exact package and permission behavior against the generated artifact before publication.

## 8. Outstanding legal and provenance questions

1. Who is the intended legal licensor (individual or entity), and who owns the project name/domain/identity?
2. Are all commits under the Git identities in §2 authored by the maintainer, and were any created for an employer, client, university, or other entity that may own the rights?
3. Does any source file contain copied/adapted code, snippets, generated output, or text from an external project beyond the named dependencies? What are the sources and applicable terms?
4. Who authored each tracked and uncommitted evaluation example/dataset? Does any dataset contain real user or social media text, and if so, what permissions/consent apply?
5. Are there contributions outside Git history (issues, pull-request patches, email, private branches), and were they incorporated? If so, obtain written permissions or exclude them from the future license until resolved.
6. Has any packaged extension been uploaded to a browser store, sent to testers, or distributed through a drive/site? Identify exact archive/version, date, included license, and recipients if possible. MIT rights in copies already provided must be honored.
7. Is any of the existing code already offered to the public by an employer/third party or under another license? Check `origin` and repository administration/ownership.
8. Does the maintainer have authority to grant the patent rights in PolyForm and any intended CLA patent grant?
9. Which commercial scenarios should require a separate license, and what user-facing examples will reduce ambiguity without altering PolyForm’s official text?
10. What attribution, name, logo, and fork-renaming policy does the maintainer want? Is the name/logo registered anywhere? No evidence of registration was found in this repository audit.
11. Will V7 uncommitted work be included in the first PolyForm release, excluded, or separately licensed? Resolve its authorship and rights before staging/committing/releasing it.
12. Which jurisdictions govern the license/CLA, and should counsel review consumer, education, nonprofit, employer, and browser-store implications?

## 9. Prioritized implementation checklist

### P0 — resolve before license migration or Stable 1.0

- [ ] Confirm legal licensor and chain of title for all existing work, including employer/contractor obligations and imported/copied content.
- [ ] Inventory past external contributions, artifacts, and user-facing releases. Preserve existing MIT notices and honor prior MIT grants; document any past ZIP/store distributions.
- [ ] Decide how the uncommitted V7 work is owned and whether it belongs in the first future-license release; do not assume a Git identity for it.
- [ ] Have counsel review the exact, unmodified PolyForm Noncommercial 1.0.0 text for the chosen licensor, jurisdiction, patent position, and intended commercial licensing model.
- [ ] Have counsel prepare/review a non-exclusive CLA with explicit commercial sublicensing/relicensing authority; decide how to handle prior contributors and DCO/sign-off before accepting future work.
- [ ] Agree Stable 1.0 release scope is local-only, then implement and verify the remote-feature/permission removal described in §7. Preserve `backend/` as experimental/developer source outside the Stable extension distribution.
- [ ] Replace README’s “open-source” claim with “source-available” once the PolyForm terms apply; keep the old MIT release clearly labeled with its old terms.

### P1 — strongly recommended before public Stable 1.0

- [ ] Add official PolyForm license text verbatim and make it available in source and every relevant distributed copy; carry any actual Required Notice lines unchanged.
- [ ] Add the separate `TRADEMARKS.md` policy and Meta/Facebook non-affiliation statement; confirm brand control and attribution language.
- [ ] Add contributor workflow: CLA is accepted before merge; check each PR’s provenance, employer authority, third-party compatibility, and license notice requirements.
- [ ] Produce a per-file/dependency/data provenance inventory; run a source and license scan on the exact release commit and final extension archive.
- [ ] Update privacy/README/store materials to state local-only classification, synced preferences, required permissions, what does not leave the device, and backend exclusion.
- [ ] Verify release artifact contents and add automated checks forbidding remote API UI, `optional_host_permissions`, remote fetch code, backend files, and undeclared third-party assets.

### P2 — can continue after the legal gate is clear

- [ ] Publish a contributor-friendly FAQ with examples for ambiguous noncommercial/commercial cases, reviewed by counsel and clearly subordinate to the license text.
- [ ] Keep independent V8 annotation/evaluation moving under documented provenance and consent, without changing frozen data or using evaluation examples as product user content.
- [ ] Maintain an SBOM/dependency notice inventory for future packaged dependencies and update it when shipped materials change.
- [ ] If community contributions expand, periodically reconcile Git authors, signed CLAs, source attributions, and release contents.

## 10. Final finding

**Future PolyForm licensing: conditionally feasible, not cleared by current evidence.** The repository’s commit history appears to record one GitHub-associated contributor account, but it does not prove legal ownership, eliminate employer or source-license issues, or cover the current uncommitted V7 patch. Public branch history contains MIT terms; future license changes cannot withdraw the rights granted for copies already distributed under MIT.

**Commercial relicensing: feasible only after rights are secured.** A DCO alone is insufficient. A carefully scoped, non-exclusive CLA can preserve contributor ownership while granting the maintainer explicit rights to sublicense and offer accepted contributions under separate commercial terms. Counsel must prepare/review it; this report does not supply a binding agreement.

**Stable 1.0 local-only: achievable with a focused packaging and UI change.** The current product does not yet meet that scope because it exposes optional remote API settings and a text-transmitting fetch path with broad optional host permissions. Remove that path from the Stable package, keep backend code separate, and verify no outbound comment-text transfer in tests and the final artifact. Do not change classification behavior as part of that scope adjustment.

**No license migration is authorized or performed by this audit.**
