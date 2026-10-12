# Debugging the content script on Facebook

The content script logs nothing by default. To diagnose a "no filtering effect"
report, enable gated debug logs and read which stage stops.

## Enabling (reversible, console only)

1. On `https://www.facebook.com/`, open DevTools Console and run:
   `localStorage.setItem("tathabbutDebug", "1")`
2. Reload the page.
3. Look for lines starting with `[Tathabbut debug]`.
4. To disable: `localStorage.removeItem("tathabbutDebug")` and reload.

No post text, author names, URLs, or page content are ever logged — only
counts, settings state, fingerprints (`hash:length`), classification modes,
outcomes, and skip reasons.

## Reading the stages

| Log | Meaning |
|---|---|
| `loaded { topFrame }` | The script executed at all. If absent, the script never ran (stale install, wrong URL match, or load error — check `chrome://extensions` for errors first). |
| `settings { enabled, categories, threshold, mode }` | Effective settings. `mode` is `local` unless a remote API is configured. |
| `scan { articles }` | How many `[role="article"]` elements were found. `0` on a feed means the selector does not match the current Facebook DOM. |
| `mutations { batches, affected }` | Observer callbacks and deduplicated articles per batch. |
| `classify { mode, labels }` | `local`, `remote`, or `remote-fallback-local`, plus matched-label count. |
| `decision { decision, reason, ... }` | Per item: `hidden` (`rule-match` + category/score) or `shown` with a reason. |
| `skip { reason }` | `filter-disabled`, `empty-text`, `unchanged`, or `queue-full`. |

## Decision reasons

- `no-rule-match`: text matches none of the narrow starter rules.
- `below-threshold`: a rule matched but its score is under the threshold.
  Stock local scores top out at **0.90** (0.86 for most categories), so a
  **99% threshold hides nothing by design** — higher means stricter, not stronger.
- `category-disabled`: the matched category is switched off in settings.
- `filter-disabled`: filtering itself is off.

## Symptom map

- No `loaded` → installation/injection problem, not a classifier problem.
- `loaded` but `articles: 0` → selector mismatch with the live DOM (comments
  especially may not carry `role="article"`; standalone comments are skipped).
- `rule-match` never appears → test content does not hit the narrow rules,
  or the threshold is above the rule scores.
- `hidden` appears but nothing visibly changes → CSS/rendering issue rather
  than detection.
