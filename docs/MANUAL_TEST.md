# Manual validation checklist

Automated checks cannot reproduce Facebook's live DOM, a logged-in profile, browser extension permissions, or long-session behavior. Record the exact artifact checksum and browser versions for any manual run. Never include real post text, author names, or profile links in the report.

## Install and inspect

- [ ] Install the extracted package in Chrome from `chrome://extensions/`.
- [ ] Install the same package in Brave from `brave://extensions/`.
- [ ] Enable Tathabbut and confirm the browser reports no manifest or script errors.
- [ ] Confirm the popup has no API URL or remote classification controls.
- [ ] Confirm the installed package manifest has only `storage` and Facebook host access; no optional origins or background service worker.
- [ ] Confirm default filtering is on, all four categories are selected, and the threshold is 85%.

## Local filtering behavior

Use self-authored or otherwise consent-safe examples only.

- [ ] Confirm a benign neutral item stays visible (ALLOW).
- [ ] Confirm one documented high-specificity harassment example is hidden (HIDE).
- [ ] Confirm an ambiguous contextual example stays visible for review (REVIEW).
- [ ] Reveal a hidden item and confirm its text is restored.
- [ ] Change settings and confirm content is re-evaluated.
- [ ] Restart the browser and confirm preferences persist.
- [ ] Enable diagnostics and confirm status updates; disable diagnostics afterwards.
- [ ] Observe a long feed for responsiveness, memory growth, and queue backpressure.
- [ ] Inspect the page console for errors and confirm no Tathabbut network request sends extracted content.
- [ ] Confirm the old API URL setting is removed on first popup open after upgrading; note any permission cleanup warning.

## Platform coverage record

For each browser, record PASS / FAIL / NOT TESTED for install, popup, local filtering, reveal, settings persistence, long-feed behavior, console errors, and service-worker errors (the local package should not have a service worker). A successful synthetic fixture run is not live Facebook validation. Do not claim Facebook compatibility unless the relevant checks were performed against a real logged-in test profile.

## Development-only lifecycle diagnostics

To inspect observer/listener disposal, the opt-in `tathabbutLifecycleDebug` local-storage flag can be enabled on the Facebook origin. This is a developer diagnostic, not proof of browser back/forward-cache behavior. It logs lifecycle metadata, not post text. The flag can be removed from the page's local storage after the check.
