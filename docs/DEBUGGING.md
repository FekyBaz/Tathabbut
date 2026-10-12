# Debugging the content script on Facebook

The content script logs nothing by default. If filtering shows no effect,
start with the popup — no console commands needed.

## Option A — popup status panel (recommended)

1. Open the Tathabbut popup and scroll to **Diagnostics**.
2. Tick **Enable diagnostic mode (this device only)**. The content script
   picks the flag up automatically; reload Facebook for a full trace.
3. Click **Refresh status** and read the panel:
   - **Content script**: running since when, or "not reported yet".
   - **Settings**: effective on/off, local/remote mode, categories, threshold.
   - **Articles found**: `[role="article"]` elements in the last scan.
   - **Evaluated / classified / hidden**: pipeline counters.
   - **Last outcome**: why the last item was hidden or shown.
4. "Not reported yet" with Facebook open means the script never reported —
   check `chrome://extensions` for load errors or reinstall the package.
   A stale timestamp means the script reported earlier but not recently.

## Option B — console logs (fallback)

1. On `https://www.facebook.com/`, run in DevTools Console:
   `localStorage.setItem("tathabbutDebug", "1")`
2. Reload, and look for `[Tathabbut debug]` lines. If nothing appears at
   all — not even `loaded` — prefer Option A: the flag may have landed in
   a different frame context, or console filters may hide extension logs.

## Log stages and decision reasons

- `loaded { topFrame }`: the script executed.
- `settings { enabled, categories, threshold, mode }`.
- `scan { articles }`: `0` on a feed means the selector does not match the
  current Facebook DOM.
- `mutations { batches, affected }`, `classify { mode, labels }`.
- `decision` / `skip` with reasons: `rule-match`, `no-rule-match`,
  `below-threshold`, `category-disabled`, `filter-disabled`, `empty-text`,
  `unchanged`, `queue-full`.

Stock local scores top out at **0.90** (0.86 for most categories), so a
**99% threshold hides nothing by design** — higher means stricter.

## Symptom map

- No status and no `loaded` → installation/injection problem.
- `articles: 0` → selector mismatch (standalone comments without
  `role="article"` are skipped by design).
- `below-threshold` → lower the threshold (e.g. 85%) for stock rules.
- `hidden` logged but nothing visibly changes → CSS/rendering issue.

## Privacy

Counts, settings state, fingerprints (`hash:length`), and outcome reasons
only. No post text, names, or URLs are recorded. Status lives in
extension-local storage on this device; nothing is sent anywhere. Disable
via the popup checkbox (or remove the `localStorage` key) and reload.
