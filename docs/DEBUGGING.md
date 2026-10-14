# Debugging the content script on Facebook

The content script logs nothing by default. If filtering shows no effect,
start with the popup — no console commands needed.

## Option A — popup status panel (recommended)

1. Open the Tathabbut popup and scroll to **Diagnostics**.
2. Tick **Enable diagnostic mode (this device only)**. The content script
   picks the flag up automatically; reload Facebook for a full trace.
3. Click **Refresh status** and read the panel (it also shows which site reported, and how old the report is):
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

- No status and no `loaded` → installation/injection problem. First check
  the address bar: the extension only runs on facebook.com hosts
  (www, web, m, and the bare apex). Any other host means no injection
  by design, not a classifier bug.
- `articles: 0` → selector mismatch (standalone comments without
  `role="article"` are skipped by design).
- `below-threshold` → lower the threshold (e.g. 85%) for stock rules.
- `hidden` logged but nothing visibly changes → CSS/rendering issue.

## Counter semantics (exact meanings)

- `articlesFound`: candidates in the most recent scan (not unique ever).
- `evaluated`: classification submissions after dedupe (text or settings
  changed). Unchanged, empty, disabled, or queue-full skips do NOT count
  here — that is why this number stays far below raw observer callbacks.
- `classified`: results that passed the staleness guard and reached a
  hide/show decision. In-flight results discarded as stale do NOT count.
- `hidden`: hide decisions actually applied (cumulative; re-hiding an
  already-hidden element does not double-count, but reveal-then-rehide
  after an edit does).
- `skipped`: elements bypassed without classification; the latest
  machine-readable cause is in `lastReason`.
- A hidden parent visually hides its children through the container's
  collapsed style; that appearance is NOT an independent classification
  of each child. Nested comments count toward their article's text.
- Standalone comments without `role="article"` are skipped by design
  (`lastReason` never advances for them on scan).
- Snapshots are per content-script instance: with several Facebook tabs
  open, each tab overwrites the single shared key, so a zero-count
  snapshot most often means a freshly loaded tab that has not finished
  its first scan (`lastReason: starting`), not a broken extension.

## Limits of the panel

- With several Facebook tabs open, the panel reflects the **most recently
  updated tab**. Pinpointing the exact tab would need extra browser
  permissions, which this extension does not request.
- A storage failure shows an explicit error row instead of silence.

## Privacy

Counts, settings state, fingerprints (`hash:length`), and outcome reasons
only. No post text, names, or URLs are recorded. Status lives in
extension-local storage on this device; nothing is sent anywhere. Disable
via the popup checkbox (or remove the `localStorage` key) and reload.
