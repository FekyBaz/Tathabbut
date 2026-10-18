# DOM lifecycle investigation: repeated hide/reveal notices

**Status:** In progress on fix/dom-reveal-lifecycle  
**First observed:** User-reported behavior on a live Facebook feed, October 2026  
**Scope:** Duplicate/repeated notices, ownership of a narrowed hide target, reversible reveal, and page-mutation churn.

## Observed behavior and evidence boundary

The user reported several repeated Arabic hide notices in the Facebook feed. They also reported that clicking Reveal restored the content at least immediately. This observation has not been independently reproduced in a live browser in this investigation; it is not yet established that every notice was a duplicate for one item rather than one notice per separately hidden item.

The current source already has a data-tathabbut-hidden guard to prevent adding controls to a target that is already marked hidden, and unit tests cover one control on a narrowed target during unrelated DOM churn. Therefore the current investigation does not assume that the duplicate-control guard is simply missing.

## Static-code finding

At the audited revision:

- hiddenTarget maps the discovered/evaluated content unit to the element actually hidden. narrowTarget() may choose a child block.
- The Reveal button listener calls reveal(target), even though the mapping was created using the original evaluated unit as its key.
- When the target is narrowed, revealing only the target can leave the original unit-to-target mapping stale.
- evaluate() intentionally invalidates a prior decision when the evaluated unit's text fingerprint changes. A Facebook metadata/timestamp mutation inside an ancestor can change the ancestor fingerprint even if the user's actual narrowed reply text stays unchanged, leading the ancestor to be reclassified and the same child to be hidden again.

This is a plausible reveal/re-hide lifecycle defect, not proof that it accounts for every live report. The fix should preserve an explicit user reveal for the same target text within the current settings version, while still reclassifying if that target's own text changes or settings change.

## Change intent

1. Maintain reverse ownership from hidden target to its evaluated owner, so reveal can clean up both directions of the relationship.
2. Make the Reveal button clear the exact owner/target pair and record the target's text fingerprint plus settings version as an explicit user override.
3. Before adding hide UI, preserve the user's reveal only if the same target text and settings version remain current. If the target text changes or the settings version changes, invalidate the override and apply the current policy.
4. Keep the existing data-tathabbut-hidden guard and reversible text wrapper behavior.
5. Add regression tests for:
   - A narrowed target stays revealed when unrelated sibling/ancestor metadata changes.
   - A narrowed target is reclassified and can be hidden again when its own text changes to new harmful text.
   - Exactly one reveal control exists whenever a target is hidden.

## Validation required

- Run the extension unit suite and TypeScript/build checks.
- Run the existing browser smoke/Playwright lab if the repo workflow/environment permits it.
- Confirm the PR CI result before calling the fix validated.
- Retest the same scenario on Facebook manually; fixture success does not prove live Facebook compatibility.

## Non-goals

This change does not solve broader Facebook DOM extraction quality, duplicated text from adjacent DOM nodes, queue prioritization, normalization parity, classifier accuracy, or model architecture. Those remain separate work items in the research decision record.
