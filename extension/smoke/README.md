# Tathabbut Testing Lab

One command, real browser, real built extension:

```bash
cd extension
npm run test:e2e
```

The command builds the extension (`tsc` + Vite + package verification),
loads the unpacked `dist/` into Chromium via Playwright, serves the
`scenarios.html` fixture matrix under facebook.com hostnames, and drives
discovery, classification, threshold, hide/reveal, dynamic-insert,
text-edit, and live-settings scenarios. It exits non-zero on failure and
writes `smoke/lab-report.json` (git-ignored) plus a console summary.

Options: `python smoke/lab.py --hosts www,web [--headless]`.
Headed Chromium is the default because headless builds do not load
extensions; needs a desktop session (for CI, run under `xvfb-run`,
which has not been verified yet).

## Fixture matrix (`scenarios.html`)

Each element id states its expected outcome at the default 85% threshold:
matching English/Arabic harassment, threats, English/Arabic spam, and a
diacritics variant hide; neutral text, respectful EN/AR disagreement,
benign DM mentions, long mixed-language text, empty content, and
standalone comments stay visible. Duplicates hide independently; nested
comments count toward their article.

To add a case: append an element with a descriptive id, then add the
matching `check(...)` line in `lab.py` with its pipeline stage
(injection, discovery, classification, threshold, hide, reveal, dynamic,
settings, diagnostics). Failing scenarios print the earliest failing
stage first.

## Failure reports

On failure the summary names the scenario, the pipeline stage, and the
expected-vs-actual outcome, e.g.:

```text
FAIL [threshold] threshold-87-www expected=False actual=True
```

Only failing scenarios capture a screenshot (`smoke/artifacts/`,
git-ignored, fixture content only — never real user content).

## Companion tools (same folder)

- `smoke_test.py` — the original smaller Chromium check, kept as-is.
- `live_check.py` — logged-out navigation of real facebook.com hosts;
  proves injection on the genuine site, not feed behavior.
- `inspector.py` — local-only DOM compatibility inspector. Prints a
  sanitized structural summary (role counts, nesting, text-length stats —
  never text, names, or URLs beyond the hostname). Usage:
  `python extension/smoke/inspector.py [--url <https-url>]`.
- `fixture.html` — the original minimal fixture for `smoke_test.py`.

## Authenticated live testing

Never automated here and never required for `test:e2e`. Follow
`docs/MANUAL_TEST.md` with an authorized test profile. Fixture green
does not imply live-DOM compatibility.
