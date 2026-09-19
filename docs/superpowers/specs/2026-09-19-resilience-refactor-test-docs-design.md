# TranslateChat Resilience, Test, and Documentation Design

- Date: 2026-09-19
- Project: TranslateChat AI Chrome extension
- Scope: Expand automated coverage, normalize provider/UI failures, capture local screenshots, and publish a user README.

## Goals

- Cover the provider and UI exception paths that can occur during translation, summary, caching, and room gating.
- Preserve the approved UX: original message stays visible, translation appears below the message, child-thread replies auto-translate, and summaries remain private.
- Make failures deterministic in tests without using production Google Chat, 9router, API keys, or real room content.
- Produce a concise README and a small set of local fixture screenshots that explain installation and daily use.

## Non-goals

- No new translation provider; the configured OpenAI-compatible provider remains the only provider.
- No automatic retry loop or hidden background retry that can increase provider cost.
- No broad rewrite of the Google Chat DOM integration or visual redesign.
- No screenshot containing real account, room, message, provider, or credential data.

## Design

### Provider error boundary

`src/provider/openai-compatible.js` will expose a normalized provider error contract with:

- `code`: stable machine-readable category such as `AUTH`, `RATE_LIMIT`, `SERVER`, `TIMEOUT`, `NETWORK`, `MALFORMED_RESPONSE`, or `CONFIGURATION`.
- `status`: HTTP status when available.
- `retryable`: whether the user can safely retry the same operation.
- `userMessage`: short safe message suitable for the inline UI.

HTTP errors, abort timeouts, network failures, malformed JSON, and missing `choices[0].message.content` will use this contract. Raw response bodies and credentials will not be surfaced to the DOM.

### Content UI state handling

The content observer will keep the current DOM integration but centralize request state handling:

- Translation requests render loading, success, and safe error states consistently.
- A failed translation never replaces or hides the original message.
- A retry is explicit through the existing action button and creates at most one new request.
- Summary errors preserve the previous summary and show a retryable error state.
- Responses from a removed message, closed summary card, or superseded request are ignored.
- Text remains rendered through `textContent`; provider output cannot create HTML nodes.

### Deterministic resilience fixture

The local provider fixture will support one-shot scenarios for successful output, 401, 429, 500, timeout, malformed JSON, missing content, and XSS-like text. Tests can enqueue a failure and then restore success to verify explicit retry behavior and request counts.

The Google Chat fixture will cover main-room messages, dynamically opened detailed-thread messages, room enable/disable gating, duplicate scans, newly added replies, edited/deleted messages, and safe body extraction.

### Test coverage

- Unit tests cover error classification, model parsing, settings validation, room gating, redaction, cache contracts, summary fingerprints, and message-surface selection.
- E2E tests cover successful translation/cache reuse, child-thread auto-translation, summary privacy/staleness, security masking, provider failures/retries, room gating, XSS-safe rendering, and duplicate request prevention.
- Full verification runs `npm test`, followed by a screenshot capture run against the deterministic fixture.

### Documentation and screenshots

`README.md` will document:

- Unpacked Chrome installation and reload flow.
- OpenAI-compatible/9router settings, model choice, and Luna preference.
- Per-room toggle behavior.
- Inline translation in main and child threads.
- Private thread summary behavior and new-message refresh.
- Local cache and credential masking.
- Common failure states and recovery steps.
- Test commands and screenshot references.

Screenshots will be stored under `docs/screenshots/` and will show settings, inline translation, child-thread translation, summary card, and one safe provider-error state from the local fixture.

## Acceptance criteria

- Existing UX tests remain green.
- New resilience tests pass for all listed deterministic provider failures.
- `npm test` exits successfully after refactoring.
- A retryable failure does not cache an error or leak raw provider data.
- README steps are sufficient to load the unpacked extension and use it with a local OpenAI-compatible endpoint.
- Screenshot assets contain only deterministic fixture content.
