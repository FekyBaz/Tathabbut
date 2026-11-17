# Privacy model — local-only Release Candidate

## Comment and post text

The extension classifies extracted text locally in the browser. This Release Candidate contains no remote classification setting, remote classification code, Backend dependency, or extension-initiated request that transmits extracted post/comment text. The local rule engine only receives text held by the content script for classification and filtering.

Normal Facebook website requests, browser/network activity, browser extensions outside Tathabbut, and traffic from other software are outside that guarantee. This statement is specifically about Tathabbut's extension code and extracted content.

## Permissions

The extension declares `storage` to save settings and local diagnostic status. It has static host access only for `https://facebook.com/*` and `https://*.facebook.com/*`, which allows the content script to inspect visible supported text on Facebook pages. It does not request optional HTTP/HTTPS host access, and there is no background service worker in this package.

## Stored data

- Filtering preferences are stored using `chrome.storage.sync`. If the user enables Chrome Sync, those preferences may sync through the user's browser account. Preferences can include enabled state, selected categories, rule-strength threshold, and UI language; they do not include extracted comments.
- Diagnostic status is stored in `chrome.storage.local` and contains aggregate counts, settings state, reason codes, and the current Facebook hostname.
- Opt-in diagnostic logs can include lengths, fingerprints, rule IDs, and reasons. They do not intentionally store post text, author names, or full page URLs. Lifecycle diagnostics, when separately enabled for development, use the Facebook page's local storage and contain lifecycle metadata only.

## Legacy remote settings

When upgrading from a prior build, opening the popup clears any previously stored API URL from the synchronized settings and attempts to remove its saved optional host permission. The current extension ignores legacy API settings even before this cleanup. If the old origin permission cannot be removed automatically, the popup reports that condition; remote classification remains unavailable.

## User controls and limits

Users can turn filtering off, choose categories, change the rule-strength threshold, enable metadata diagnostics, and reveal hidden content. The filter does not report, delete, or post content. Local rules can still make false-positive and false-negative decisions; see [responsible filtering](RESPONSIBLE_FILTERING.md).
