# Message Body Rendering Design

- Date: 2026-09-19
- Goal: Keep Google Chat messages readable while showing AI translation without copying host user metadata into the translation.

## Root Cause

The content script currently derives text from the whole Google Chat message container. On the live room, that container includes the author header and the external-user status (`domain_disabled` / localized external-user text), so the provider receives metadata as if it were message content. The extension also appends its controls to `[data-message-actions]`, which is a host header/action area rather than the message body.

## Design

1. Preserve explicit fixture/test text from `data-text`.
2. For live Google Chat nodes, clean the extracted text by removing host-only metadata, author header duplicates, timestamps, reaction labels, reply-count labels, and extension UI text.
3. Keep message body text and summary input based on the cleaned value, so metadata cannot enter translation, summary, or cache keys.
4. Mount the extension controls in a dedicated extension-owned surface appended after the host message node. Do not append inside `[data-message-actions]`.
5. Keep the original Japanese content untouched; the translation remains an additional block beneath the host message.

## Error Handling

- Empty cleaned text is ignored and does not receive a translation button.
- Existing provider/cache behavior remains unchanged.
- A page reload after the extension update creates new cache keys because cleaned message text differs from the old metadata-contaminated text.

## Verification

- Unit tests cover removal of external-user metadata and header/status noise while preserving Japanese body text.
- E2E tests verify the translation surface is outside the host action/header area and that provider requests do not contain the external-user status.
- Full `npm test` is required before claiming completion.
