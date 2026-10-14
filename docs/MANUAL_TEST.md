# Manual live-Facebook test procedure

Automated checks cannot reproduce Facebook's live DOM, login state, or feed
behavior. Use this procedure with a dedicated test profile before any beta
or public claim.

## Setup

- Browser: Chrome (record the exact version from `chrome://version`).
- Extension: fresh `npm run build` artifact from the branch under test.
  Open `chrome://extensions/`, enable Developer mode, remove any older
  copy of Tathabbut, then Load unpacked and select the `extension/dist`
  directory. Confirm the install shows no errors.
- Confirm the installed copy matches the reviewed commit (compare the
  popup Diagnostics behavior and the `dist/content.js` build date).
- Page: `https://www.facebook.com/` logged into the test profile.
- Popup: filtering enabled, all four categories on, threshold **85%**.

## Scenarios

1. **Injection check.** Open DevTools Console on the feed. With diagnostic
   mode on (popup checkbox), expect `[Tathabbut debug] loaded`. Record
   whether it appears.
2. **Control positive.** If the feed has no matching content, post a known
   control phrase from the test profile that matches a documented starter
   rule, reload, and confirm the item is hidden with a reveal control.
3. **Control negative.** Confirm a respectful disagreement or neutral post
   stays visible.
4. **Reveal.** Click the reveal control and confirm the content is restored.
5. **Dynamic feed.** Scroll to load more items and confirm newly inserted
   items are processed without a page reload.
6. **Edited text.** Edit a test post and confirm it is re-evaluated.
7. **Settings.** Change the threshold to 99% and confirm stock-rule items
   stop hiding (higher means stricter); restore 85% afterwards.
8. **Popup status.** Open the popup, press Refresh status, and record
   articles found, evaluated/classified/hidden, last outcome, and freshness.
9. **Comments.** Record whether comment threads carry `role="article"`;
   standalone comments without it are skipped by design.

## Controlled live check (short version)

Use one self-authored test post with four self-authored comments, threshold
**85%**, all categories on. Record only counts and outcome codes — never
paste real post text, names, or links into any report.

Expected starter-rule outcomes (current narrow rules, by design):

- `I will kill you.` → hidden (threats).
- `You are an idiot.` → hidden (harassment).
- `FREE FREE FREE CLICK NOW CLICK NOW CLICK NOW` → stays visible
  (matches no starter spam rule; shouty promo text is deliberately not
  covered to avoid punishing ordinary posts).
- `I respectfully disagree with your opinion.` → stays visible.

Then, in order: add one more matching comment while the page is open
(dynamic insert), edit one hidden comment to neutral text and confirm it
is restored, click a reveal control and confirm restore, switch to 99%
and confirm stock-rule items stop hiding, switch back to 85%, refresh,
and open the same feed in a second tab (each tab overwrites the shared
status key — compare `updatedAt` freshness, not just counts).

Report template per step: `visible|hidden`, popup
`articles/evaluated/classified/hidden/skipped`, `lastReason`, and whether
the snapshot was fresh. That is all that is needed — no content.

## Recording results

For each scenario record: expected result, actual result, diagnostic
evidence (status panel values or debug lines), browser/extension versions,
and the feed type (home feed, group, page). Any mismatch is a bug report
with these fields attached.
