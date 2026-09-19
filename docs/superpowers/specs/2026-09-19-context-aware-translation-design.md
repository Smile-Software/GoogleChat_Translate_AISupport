# Context-Aware Translation Design

- Date: 2026-09-19
- Project: TranslateChat AI
- Status: Proposed, awaiting user review

## Goal

Improve translation quality for enabled Google Chat rooms by giving the AI a compact understanding of the room and the complete currently loaded thread, while translating only the new message. The room context is created from the loaded room history once, then incrementally refreshed about once every 24 hours with the previous context plus newly observed messages.

## Confirmed Product Decisions

- Only explicitly enabled rooms may create or use context.
- The first room context uses all room messages currently loaded in Google Chat.
- Each translation receives the complete currently loaded message set for the active thread as context.
- The target message is sent separately and is the only text the provider may translate.
- Quote blocks, quote labels, and quote navigation hints are excluded from room history, thread history, and the target message.
- A room context refresh runs at most once per 24-hour period after the context becomes stale.
- A refresh combines the previous room context with messages not covered by that context; it does not re-summarize the full room history in the normal append-only case.
- Translation must remain usable while a stale context refresh runs in the background.
- Raw room history is not persisted in local storage; only the compact context and coverage metadata are cached.
- Translation and context generation use the configured OpenAI-compatible provider and selected model, with Luna-first model selection preserved.

## Scope

### In scope

- Room-level context creation and incremental refresh.
- Thread-level context passed into each uncached translation request.
- Local context cache, coverage fingerprints, expiration, and invalidation.
- Provider prompts that clearly separate room context, thread history, and target message.
- Safe fallback when context generation or refresh fails.
- Popup/status feedback for context readiness and stale refresh state.
- Unit and Playwright coverage for context extraction, caching, refresh, failures, and prompt boundaries.

### Out of scope

- Sending translated text or room summaries back into Google Chat.
- Cross-room context sharing.
- Server-side persistence of room history or context.
- Automatic translation of quoted content.
- Re-translating already cached messages solely because the room context changed.

## Architecture

The content script remains responsible for reading the rendered Google Chat DOM. It extracts three separate data sets:

1. `roomMessages`: main-room messages currently loaded in the room, cleaned of UI metadata and quote branches.
2. `threadMessages`: all currently loaded messages in the active thread, cleaned using the same rules.
3. `targetMessage`: the one new message that must be translated.

The content script sends these data sets to the service worker only when needed. The service worker owns provider calls, redaction, cache reads/writes, and context refresh coordination. The provider module owns prompt construction and must never decide which DOM content is a quote.

The existing generic IndexedDB cache remains the storage layer. Room context uses a separate cache kind and key namespace from translations and summaries.

## Data Flow

### First translation in a room without context

1. Confirm the room is enabled.
2. Extract the currently loaded room messages, current thread messages, and target message.
3. Build a room context from the full loaded room history.
4. If context creation succeeds, use it with the complete thread history to translate the target message.
5. If context creation fails, continue with the existing simple translation prompt plus thread history where possible.
6. Cache the context only after a complete successful provider response.

The first translation may take one additional provider request because the room context must be created before it can improve the translation. The UI shows a non-blocking `Đang chuẩn bị ngữ cảnh room...` state when this happens.

### Translation while context is fresh

1. Read the cached room context.
2. Extract the complete currently loaded thread history and target message.
3. Send the cached room context, thread history, and target message in one translation request.
4. Do not send the full room history to the provider.

### Translation after context expires

1. Use the existing context immediately for the current translation.
2. Start one background refresh for that room if no refresh is already in flight.
3. Extract the currently loaded room messages for refresh comparison.
4. In the append-only case, send the previous context plus uncovered/new messages to create the new context.
5. On success, replace the cached context and coverage metadata.
6. On failure, retain the old context and expose a quiet status that the next eligible refresh will retry.

### Non-append changes

If a covered message is edited, deleted, or no longer matches the stored coverage fingerprint, the service worker must not silently merge a potentially stale delta. It rebuilds context from all currently loaded room messages. If the rebuild fails, the previous context remains active.

## Context Model

The cache value for `room-context:<roomId>` contains:

```js
{
  roomId: "fixture-room",
  roomLabel: "Chemmat room",
  summary: "...",
  coveredMessageIds: ["m-1", "m-2"],
  coveredFingerprint: "sha256(...)" ,
  generatedAt: 0,
  expiresAt: 0,
  schemaVersion: 1
}
```

The context summary should be compact and practical rather than a transcript. It should preserve:

- room subject and terminology;
- names, aliases, and roles when relevant;
- decisions and their dates when available;
- owners and responsibilities;
- current status, blockers, and unresolved questions;
- conventions needed to interpret later messages.

The summary must not preserve secrets that redaction removes from provider input. The local cache stores only the provider-generated summary and coverage metadata, not the raw room messages.

The default refresh interval is 24 hours. It should be represented as a named constant in the context service so tests can inject a shorter interval without changing product behavior.

## Provider Prompt Boundaries

The provider module will add a context-aware translation builder with explicit delimiters:

```text
ROOM CONTEXT:
<compact room summary>

THREAD HISTORY:
<all loaded messages in chronological order>

MESSAGE TO TRANSLATE:
<new message only>
```

The system instruction must state:

- use room and thread sections only to resolve meaning, terminology, references, and omitted subjects;
- translate only `MESSAGE TO TRANSLATE`;
- do not translate, quote, summarize, or repeat context sections;
- preserve URLs, names, line breaks, and tone;
- return the translation only.

The context refresh prompt will use:

```text
ROOM CONTEXT CŨ:
<previous compact context>

MESSAGE CHƯA ĐƯỢC GOM:
<new or changed messages>

Create the new compact room context. Keep still-valid information, add confirmed changes,
and remove information contradicted by the new messages. Return context only.
```

All provider-bound text passes through the existing credential redaction path before request construction. Quote filtering happens before redaction and prompt construction.

## Cache and Request Identity

- Translation cache remains keyed by target text, source language, target language, model, and translation prompt version.
- Room context cache uses `room-context:<roomId>` and the generic cache `kind: "room-context"`.
- A context refresh is deduplicated per room with an in-flight operation map in the service worker.
- A context refresh failure is never cached as a successful context.
- Existing translation cache entries are not invalidated just because a room context refresh succeeds; new or explicitly retried translations use the newest context.
- Context coverage fingerprints include message IDs, author, timestamp, and cleaned message text so edits and deletions trigger a safe rebuild.

## UX Behavior

- Normal translation UI remains below the original message and does not display room history.
- The first context build shows a small status near the translation action, then replaces it with the translation or a safe provider error.
- A stale context refresh does not block a translation already using the old context.
- The extension popup exposes a compact room-context status: `Chưa tạo`, `Đang cập nhật`, `Sẵn sàng`, or `Dùng context cũ`.
- The popup may show the last context update time and a manual `Cập nhật ngữ cảnh` action for troubleshooting, but manual refresh is not required for normal operation.
- Context summaries are never injected into the Google Chat message stream.

## Failure Handling

- No provider configuration: preserve the current safe error and do not create a context cache entry.
- Authentication, rate-limit, server, timeout, network, malformed, or empty context responses: preserve the prior context when one exists; otherwise fall back to simple translation without room context.
- Context refresh must not create an automatic retry loop. The next translation after the refresh interval may attempt it again.
- If the provider rejects a large initial history, split the loaded room history into deterministic chunks, summarize each chunk, then merge the chunk summaries. If chunking or merging fails, use the simple translation fallback.
- If message extraction returns no usable text, do not send an empty context or empty translation target.
- If the room becomes disabled, stop context refreshes and remove only injected UI; existing local cache may remain until normal TTL cleanup or explicit cache clearing.

## Testing Strategy

### Unit tests

- Build context-aware translation prompts and assert only the target section is translatable.
- Build room-context creation and incremental-refresh prompts.
- Exclude quote content and quote wrapper labels from room and thread data.
- Generate stable coverage fingerprints and detect append-only, edit, and delete changes.
- Enforce the 24-hour expiration decision and stale-context fallback.
- Keep room-context cache entries isolated from translation and summary namespaces.
- Deduplicate concurrent room refresh requests.

### End-to-end tests

- First translation creates a room context from all loaded room messages.
- Translation payload contains room context, full thread history, and target message as separate sections.
- Older thread messages improve terminology without being translated again.
- Quote content and `đã trích dẫn`/`Kết thúc trích dẫn` labels are absent from every provider payload.
- A second translation before 24 hours reuses the context without another context request.
- A translation after 24 hours uses the old context immediately and triggers only one incremental refresh.
- Incremental refresh sends the previous context plus only uncovered new messages.
- Edited or deleted covered messages trigger a full rebuild from currently loaded history.
- Context provider failures preserve the old context and still render a translation.
- A room outside the allowlist never creates a context request.
- Opened child threads use the room context and the correct thread message set.
- Popup context status reflects ready, updating, stale fallback, and failure states.

## Implementation Boundaries

The implementation plan should keep responsibilities separated:

- `src/content/chat-observer.js`: collect room/thread context inputs and pass them with translation requests.
- `src/content/message-text.js`: shared text cleaning and quote exclusion helpers where pure logic is testable.
- `src/provider/openai-compatible.js`: context-aware prompt builders only; no DOM or cache behavior.
- `src/background/service-worker.js`: context lifecycle, redaction, refresh coordination, and cache integration.
- `src/cache/indexed-db.js`: reuse generic cache contracts; add only the smallest kind/namespace support needed.
- `src/settings/schema.js` and popup files: only add user-visible context status or a refresh control if required by the final UX review.
- `tests/fixtures/google-chat.html`, unit tests, and E2E tests: deterministic room history, thread history, quote wrappers, daily refresh, and failure scenarios.

## Risks and Mitigations

- Google Chat DOM markup changes: keep selectors centralized and retain a simple-translation fallback when context extraction is incomplete.
- Large initial history: chunk and merge summaries within a provider-safe input budget.
- Increased first-translation latency: make later translations fast through local room-context caching and use stale-while-revalidate after expiry.
- Context drift: store coverage fingerprints and rebuild on edits/deletions rather than blindly appending.
- Sensitive room data: redact before provider requests and never persist raw history.
- Ambiguous context instructions: use explicit delimiters and tests that reject context text in the translation output.

## Acceptance Criteria

- A Japanese message can be translated using room terminology and decisions from earlier messages.
- The provider receives the full loaded thread as context but translates only the target message.
- The room history is summarized once initially and incrementally refreshed no more than once per 24 hours in the normal case.
- Quote content and quote navigation labels never reach the provider.
- Cached context and translations remain isolated, local, redacted, and resilient to provider failures.
- Existing room toggles, child-thread translation, inline rendering, cache reuse, summary, and error UX continue to pass.
