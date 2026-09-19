# TranslateChat AI Test Report

- Date: 2026-09-19
- Environment: macOS arm64, Node v25.9.0, npm 11.12.1, Playwright 1.63.0, Chromium extension context
- Provider: deterministic local OpenAI-compatible mock server used by the test harness
- Chat: deterministic local Google Chat fixture; no production room or message content

## Results

- Unit: 32 passed, 0 failed
- E2E: 17 passed, 0 failed
- Full command: `npm test`
- Screenshot command: `node scripts/capture-readme-screenshots.mjs`

The full suite covers the original UX flows plus the resilience suite. The final release verification runs the full command twice consecutively after screenshot capture.

## Refactoring Verified

- Provider failures use a safe structured contract with `code`, `status`, `retryable`, and `userMessage`.
- Covered authentication, rate limit, server, timeout, network, malformed JSON, missing content, and unknown error fallback paths.
- Translation failures preserve original message text and expose explicit retry only.
- Summary refresh failures preserve the previous private summary and show a retryable error.
- Responses for removed/superseded UI are ignored by the content operation-state helper.
- Provider HTML-like output is rendered as text and cannot create DOM elements.

## Verified User Flows

- Inline Japanese-to-Vietnamese translation below the original message
- Translation cache reuse after reload
- Auto-translation for newly added messages
- Auto-translation inside an opened detailed child thread
- Per-room allowlist: disabled room receives no translation UI
- Three-dot menu action `Tóm tắt thread bằng AI`
- Private summary card with no Google Chat message mutation
- Stale summary badge after a new reply
- Summary refresh with old summary preserved when the provider fails
- Luna-first model ordering
- Credential masking before provider request
- Safe rendering of provider text containing HTML-like content
- Quoted message content is excluded from translation provider requests
- Explicit retry after 401/429/500 and timeout states

## Automated Test Files

- Unit provider error contract: `tests/unit/provider-errors.test.js`
- Unit operation state: `tests/unit/operation-state.test.js`
- Existing pure logic tests: `tests/unit/*.test.js`
- Translation and child thread: `tests/e2e/translation.spec.js`
- Summary: `tests/e2e/summary.spec.js`
- Settings and popup: `tests/e2e/settings.spec.js`
- Security: `tests/e2e/security.spec.js`
- Resilience and exception paths: `tests/e2e/resilience.spec.js`

## Screenshots

- [Settings](screenshots/01-settings.png)
- [Inline translation](screenshots/02-inline-translation.png)
- [Child thread translation](screenshots/03-child-thread.png)
- [Private summary card](screenshots/04-summary-card.png)
- [Provider error state](screenshots/05-provider-error.png)

All screenshots are generated from the local deterministic fixture. They contain no real account, API key, room, or production provider data.

## Known Limitations

- Automated browser coverage uses Chromium plus the local fixture; live Google Chat DOM changes still require a manual smoke check after Google changes its markup.
- The CUA browser connector may be unavailable when Codex auth is unavailable; this does not affect CLI/Playwright verification.
- No automatic retry loop is enabled; users retry explicitly to control provider cost.

## Cleanup

- Local mock provider and fixture servers are closed by every test and screenshot capture `finally` block.
- Test credentials are deterministic placeholders and are never used outside the local fixture.
