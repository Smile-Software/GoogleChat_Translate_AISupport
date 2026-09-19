# Google Chat AI Translation Extension Design

- Date: 2026-09-18
- Project: TranslateChat
- Workspace: /Users/vudn/Documents/works/TranslateChat
- Status: Approved 2026-09-18

## Goal

Build a Chrome Manifest V3 extension for Google Chat that translates Japanese messages inline, lets the user switch target language, and summarizes a thread through an AI provider using an OpenAI-compatible API such as 9router.

## UX

### Extension icon popup

The popup is a compact control surface:

- Translation on/off
- Target language, default Tiếng Việt
- Selected AI model, with model IDs containing luna sorted first
- Provider connection status
- Cache status and clear-cache action
- Link to full Settings

The popup must not hold long summaries. Chrome closes this popup when focus leaves it.

### Inline translation

The content script adds a small action to each Google Chat message. Translation renders directly below the original message. Original text remains visible. The translated block is visually subordinate, dismissible, and marked as extension output.

New messages are detected with MutationObserver and translated after a short debounce. Existing translated text is not requested again when its cache key matches.

### Thread summary

Add Tóm tắt thread bằng AI to the message three-dot menu when the message belongs to a thread. The action opens a private extension card anchored in the thread panel. It must not create or send a Google Chat message.

The card contains:

- Summary text
- Selected model and last-updated time
- Cập nhật, Copy, and Đóng
- Stale badge such as Có 2 message mới

Summary refresh is manual in MVP. A later setting may enable automatic refresh.

### Settings

Keep Settings split into four groups:

1. AI Provider: Base URL, masked API key, test connection, model list, selected model, request timeout.
2. Translation: auto-detect source, default target, quick target languages, auto-translate new messages, show original.
3. Summary: output language, length, manual or automatic refresh, include replies.
4. Privacy and Cache: credential masking, cache TTL, clear translation cache, clear summary cache.

API keys stay in local extension storage and never sync through Chrome Sync.

## Architecture

- Content script observes Google Chat DOM, identifies messages and thread controls, injects inline translation and private summary UI.
- Service worker owns provider requests, cache calls, settings reads, retry policy, and message passing.
- Options page owns Settings UI and validation.
- IndexedDB stores translation and summary cache entries. chrome.storage.local stores settings and API key.
- Provider client targets OpenAI-compatible /models and /chat/completions-style endpoints. The exact 9router URL and model ID are user-configured.
- Tests use a local Google Chat fixture and a local mock provider. No test sends room data to production Google Chat or 9router.

## Data flow

1. Content script extracts visible message text, author, timestamp, thread ID, and stable message ID when available.
2. Sanitizer masks credential-like values before any outbound request.
3. Translation cache lookup uses source text, source language, target language, provider mode, and prompt version.
4. Cache miss sends translation request through the service worker.
5. Result is validated, stored in IndexedDB, and rendered inline.
6. Summary action collects thread messages and builds a fingerprint from ordered message IDs and text hashes.
7. Cached summary is shown when fingerprint matches.
8. New messages keep old summary visible with a stale badge. Manual refresh sends prior summary plus new messages when safe; edits, deletes, or unstable IDs force a full-thread request.

## Security and privacy

- Never log API keys, raw credentials, or full outbound message bodies.
- Mask common Password, bearer token, API key, secret, and credential patterns before provider calls.
- Show a warning when masking changes text.
- Do not post translation or summary content to Google Chat.
- Do not request broad host permissions beyond Google Chat and the configured provider URL.
- Store keys only in chrome.storage.local; do not use chrome.storage.sync.
- Clear cache removes translation and summary records from IndexedDB.

## Error behavior

- Missing provider configuration: show actionable Settings link; leave original messages intact.
- Provider timeout or 429: show retry action and retain original text.
- Malformed provider response: reject result; do not cache it.
- DOM shape change: fail closed, keep Chat usable, emit non-sensitive diagnostic code.
- Summary with new messages: show stale state; never silently claim summary is current.

## Acceptance criteria

- User can translate Japanese messages inline to Tiếng Việt.
- User can select another target language without losing the original.
- Reopening or rescanning a message with unchanged text does not call the provider again.
- User can select a model, with luna models listed first.
- User can summarize a thread from its three-dot menu.
- Summary appears only in extension UI and never as a Google Chat message.
- New thread messages mark summary stale and manual refresh updates it.
- Credential-like text is masked before outbound requests.
- Settings validation, cache clearing, provider errors, and DOM changes are covered by automated tests.
