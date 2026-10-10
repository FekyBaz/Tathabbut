# Security Policy

## Supported versions
Security support applies to the latest code on the default branch and latest published release, when releases exist.

## Reporting
Do not publish exploit details, tokens, private feed content, or sensitive logs in a public issue. Use GitHub private vulnerability reporting if enabled, or contact the maintainer privately through GitHub.

## Security expectations
- Provider API keys must never be embedded in extension source.
- Do not store Facebook cookies, access tokens, credentials, or session data.
- Only send text to a remote API when remote classification is explicitly configured.
- Validate API responses and treat page text/model responses as untrusted input.
- Keep permissions narrow and justify expansions in the PR.
