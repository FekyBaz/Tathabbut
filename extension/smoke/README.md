# Browser smoke test (Playwright + Chromium)

Loads the unpacked extension from `../dist` into a real Chromium and serves
a local feed fixture under `https://www.facebook.com/` and
`https://web.facebook.com/` via request routing, then verifies the full
pipeline: injection, discovery, classification, hide, reveal, dynamic
inserts, status snapshots, and the popup panel.

## Prerequisites

- Python Playwright and a Chromium build:
  `pip install playwright && python -m playwright install chromium`
- A fresh `npm run build` in `extension/` (the test loads `../dist`).
- A desktop session (the test launches headed Chromium).

## Run

From the repository root:

```bash
python extension/smoke/smoke_test.py
```

Results are printed to the console and appended to a `smoke_log.txt` file
next to the script. Exit code `0` means every check passed.

## What it proves (and does not)

Proven when green: manifest matching on both hosts, classic-script content
loading, feed discovery, local classification, threshold decisions,
reversible hiding, observer-driven inserts, and popup diagnostics.

Not proven: compatibility with Facebook's live DOM, which changes
independently of this repository and still requires the manual procedure
in `docs/MANUAL_TEST.md` on a real feed.
