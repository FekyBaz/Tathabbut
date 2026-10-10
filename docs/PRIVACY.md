# Privacy model

## Local-first
The extension processes visible feed text locally by default. It stores user preferences in Chrome storage and does not need passwords, cookies, DMs, friend lists, or account tokens.

## Optional remote classification
When a user intentionally configures an API URL, only the selected text snippet and requested categories are sent through the extension service worker. The extension asks for optional host access to the configured API host, rather than making cross-origin requests directly from the Facebook page. Non-local hosts must use HTTPS. Clearing or changing the API URL removes the previous host permission. Do not send profile names, post authors, cookies, or surrounding page metadata unless a future feature establishes a specific need and documents it.

## Retention and logging
The starter API does not log submitted text. Deployers must review web-server, hosting, proxy, and provider logs/retention settings before production use. Do not send sensitive content to third-party models without informed consent and an understandable retention policy.

## User controls
- Categories can be switched on/off.
- Confidence threshold is configurable.
- Hidden content can be revealed.
- API use is disabled unless configured.
- No content is reported to Facebook or deleted.

## Contributor checklist
1. Can this run locally?
2. What exact data leaves the browser?
3. Has the user been told and given control?
4. Is content logged or persisted?
5. Can the feature work without identity data?
