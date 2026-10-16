# Architecture

## Data flow
Facebook page -> content script -> local conservative classifier -> policy engine -> reversible local hide/restore UI.

If the user configures an API URL, the extension can send the text snippet and selected categories to that API. This is an explicit configuration; no remote provider is contacted by default.

## Extension
- Chrome Manifest V3 and TypeScript.
- Reads visible text from candidate feed units.
- Hides a candidate using a reversible CSS class; never deletes page content.
- When a unit holds several sibling blocks and exactly one of them independently
  triggers a hide, only that block is hidden (narrow target); single-block
  units, multi-match units, and remote verdicts without a local explanation
  keep unit-level hiding. Reveal always restores exactly the hidden target.
- Stores preferences in Chrome storage.
- Does not read private messages, passwords, cookies, or tokens.
- Uses a MutationObserver for newly inserted feed items.
- Facebook DOM selectors are not a stable API and require manual regression tests.

## API
- `GET /health`
- `POST /v1/classify`
- Validates request length and categories.
- Uses deterministic local rules in this starter; no external model SDK is currently called.

## Classification contract
Request:
```json
{
  "text": "the text snippet",
  "enabled_categories": ["harassment", "hate", "threats", "spam"]
}
```

Response:
```json
{
  "labels": [{"category": "harassment", "score": 0.86}],
  "provider": "local-heuristic"
}
```

Allowed categories:
- `harassment`: targeted personal insult or abuse.
- `hate`: hateful or dehumanizing attack against an identity group.
- `threats`: threat of physical harm.
- `spam`: repetitive or deceptive promotional content.

Misinformation is not in the active category list because verifying claims requires evidence and provenance, not merely a sentence.

## Future external provider requirements
Before adding a provider: server-side secrets, timeouts, payload limits, rate limits, strict schema validation, retention notice, prompt-injection tests, and diverse false-positive evaluation.
