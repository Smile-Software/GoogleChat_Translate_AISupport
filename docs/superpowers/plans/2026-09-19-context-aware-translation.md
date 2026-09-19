# Context-Aware Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dịch message trong room Google Chat bằng room context được tóm tắt incremental mỗi 24 giờ và toàn bộ thread context đang load, trong khi chỉ dịch message mới.

**Architecture:** Content script làm sạch và thu thập room/thread messages từ DOM. Service worker quản lý room-context cache, redaction, refresh incremental và fallback. Provider module chỉ xây prompt với ba vùng rõ ràng: room context, thread history, target message.

**Tech Stack:** Chrome MV3, JavaScript ES modules, IndexedDB, Node test runner, Playwright, local OpenAI-compatible provider fixture.

## Global Constraints

- Chỉ room đã bật trong `roomAllowlist` mới được tạo hoặc dùng context.
- Lần đầu dùng toàn bộ message room đang được Google Chat load; các lần sau dùng context cũ + message chưa được gom.
- Context room refresh tối đa một lần trong 24 giờ ở trường hợp append-only bình thường.
- Mỗi lần dịch uncached gửi toàn bộ thread đang load làm context và gửi target message riêng; AI chỉ được dịch target.
- Quote content, `đã trích dẫn`, `Kết thúc trích dẫn`, và hướng dẫn liên kết quote không được gửi tới provider.
- Không lưu raw room history; chỉ lưu compact context và coverage metadata trong local cache.
- Context refresh không được chặn bản dịch đang dùng context cũ.
- Provider failure không tạo cache thành công và không tạo automatic retry loop.
- Giữ nguyên room toggle, child-thread translation, inline rendering, summary, cache translation và error UX hiện tại.

---

## File Map

- Create: `src/context/room-context.js` — pure context TTL, fingerprint, append-only/delta/rebuild decisions, and cache-value helpers.
- Create: `src/context/context-lifecycle.js` — dependency-injected context resolve/refresh orchestration used by the service worker and unit tests.
- Modify: `src/provider/openai-compatible.js` — context-aware translation prompt and room-context prompt builders.
- Modify: `src/background/service-worker.js` — room-context cache lifecycle, refresh deduplication, redaction, and translation integration.
- Modify: `src/content/chat-observer.js` — collect room/thread inputs, remove quote wrappers before collection, pass context data, and expose context status.
- Modify: `src/popup/popup.html` — add compact room-context status and manual refresh control.
- Modify: `src/popup/popup.js` — read/render context status and send manual refresh for the active tab.
- Modify: `tests/fixtures/google-chat.html` — deterministic room history, thread messages, edits, deletes, and quote wrappers.
- Modify: `tests/fixtures/provider-server.js` — distinguish translation, room-context creation, and room-context refresh requests.
- Modify: `tests/unit/provider.test.js`, `tests/unit/cache.test.js` — prompt and cache contract coverage.
- Create: `tests/unit/room-context.test.js` — pure context state tests.
- Modify: `tests/e2e/translation.spec.js`, `tests/e2e/security.spec.js`, `tests/e2e/settings.spec.js`, `tests/e2e/resilience.spec.js` — context-aware acceptance and exception coverage.
- Modify: `docs/test-report.md`, `README.md` — describe context behavior and verified tests.

---

### Task 1: Add Pure Room-Context State Helpers

**Files:**
- Create: `src/context/room-context.js`
- Create: `tests/unit/room-context.test.js`

**Interfaces:**
- Produces `ROOM_CONTEXT_TTL_MS`, `serializeContextMessages(messages)`, `fingerprintContextMessages(messages)`, `isContextFresh(entry, now)`, `classifyContextMessages(previousMessages, currentMessages)`, `selectUncoveredMessages(previousMessages, currentMessages)`, and `createRoomContextValue(input)`.
- `classifyContextMessages` returns exactly one of `{ kind: "initial" }`, `{ kind: "append", messages }`, or `{ kind: "rebuild", messages }`.
- `createRoomContextValue({ roomId, roomLabel, summary, messages, generatedAt, expiresAt })` returns the cache value fields documented in the spec and never includes raw message text outside the returned summary.

- [ ] **Step 1: Write failing unit tests**

```js
test("marks an absent context as initial", () => {
  assert.deepEqual(classifyContextMessages([], [{ id: "m-1", text: "A" }]), { kind: "initial" });
});

test("selects only uncovered messages for append-only updates", () => {
  const previous = [{ id: "m-1", author: "A", time: "10:00", text: "Old" }];
  const current = [...previous, { id: "m-2", author: "B", time: "10:01", text: "New" }];
  assert.deepEqual(classifyContextMessages(previous, current), {
    kind: "append",
    messages: [current[1]]
  });
});

test("requests a rebuild when a covered message changes", () => {
  const previous = [{ id: "m-1", author: "A", time: "10:00", text: "Old" }];
  const current = [{ id: "m-1", author: "A", time: "10:00", text: "Edited" }];
  assert.deepEqual(classifyContextMessages(previous, current), { kind: "rebuild", messages: current });
});

test("expires context at the 24-hour boundary", () => {
  assert.equal(isContextFresh({ expiresAt: 2_000 }, 1_999), true);
  assert.equal(isContextFresh({ expiresAt: 2_000 }, 2_000), false);
});
```

- [ ] **Step 2: Run the focused test to verify the expected failure**

Run: `node --test tests/unit/room-context.test.js`

Expected: FAIL because `src/context/room-context.js` does not exist yet.

- [ ] **Step 3: Implement the smallest pure state module**

Use stable JSON tuples `[id, author, time, text]` for comparison. Treat a current list as append-only only when every previous tuple exists at the same index and the current list is at least as long. Return `rebuild` for edits, deletions, reordering, or an empty previous coverage set.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test tests/unit/room-context.test.js`

Expected: all context-state tests PASS.

- [ ] **Step 5: Commit the isolated state contract**

```bash
git add src/context/room-context.js tests/unit/room-context.test.js
git commit -m "feat: add room context state helpers"
```

### Task 2: Add Context-Aware Provider Prompts

**Files:**
- Modify: `src/provider/openai-compatible.js`
- Modify: `tests/unit/provider.test.js`

**Interfaces:**
- Preserve `buildTranslationMessages(text, sourceLanguage, targetLanguage)` for existing callers.
- Add `buildContextAwareTranslationMessages({ text, sourceLanguage, targetLanguage, roomContext, threadMessages })`.
- Add `buildRoomContextMessages({ roomLabel, messages })` for initial context creation.
- Add `buildIncrementalRoomContextMessages({ previousContext, newMessages })` for daily refresh.

- [ ] **Step 1: Write failing prompt tests**

```js
test("separates room context, thread history, and target message", () => {
  const messages = buildContextAwareTranslationMessages({
    text: "新しい確認です。",
    sourceLanguage: "auto",
    targetLanguage: "vi",
    roomContext: "Toyota is the project owner.",
    threadMessages: [{ author: "A", time: "10:00", text: "Toyota sẽ kiểm tra." }]
  });
  assert.match(messages[1].content, /ROOM CONTEXT:/);
  assert.match(messages[1].content, /THREAD HISTORY:/);
  assert.match(messages[1].content, /MESSAGE TO TRANSLATE:/);
  assert.match(messages[1].content, /新しい確認です。/);
  assert.match(messages[0].content, /translate only.*target/i);
});

test("builds incremental context from the previous summary and new messages", () => {
  const messages = buildIncrementalRoomContextMessages({
    previousContext: "Old decision",
    newMessages: [{ author: "B", time: "10:01", text: "New decision" }]
  });
  assert.match(messages[1].content, /Old decision/);
  assert.match(messages[1].content, /New decision/);
});
```

- [ ] **Step 2: Run provider tests to verify the new tests fail**

Run: `node --test tests/unit/provider.test.js`

Expected: FAIL with missing builder exports.

- [ ] **Step 3: Implement prompt builders with explicit boundaries**

Format chronological thread entries as `[author time] text`. The system prompt must state that context is reference-only, that only the target section may be translated, and that URLs, names, line breaks, and tone must be preserved. Return translation only. The context builders must return context-only instructions and never include quote metadata.

- [ ] **Step 4: Run provider tests and the existing unit suite**

Run: `node --test tests/unit/provider.test.js tests/unit/*.test.js`

Expected: new prompt tests and all existing unit tests PASS.

- [ ] **Step 5: Commit prompt contracts**

```bash
git add src/provider/openai-compatible.js tests/unit/provider.test.js
git commit -m "feat: add context-aware translation prompts"
```

### Task 3: Integrate Room Context Cache and Incremental Refresh

**Files:**
- Modify: `src/background/service-worker.js`
- Create: `src/context/context-lifecycle.js`
- Modify: `tests/unit/cache.test.js`
- Modify: `tests/unit/room-context.test.js`

**Interfaces:**
- Add `ROOM_CONTEXT_KIND = "room-context"` and `room-context:<roomId>` key construction in the service worker.
- `src/context/context-lifecycle.js` exports `createRoomContextLifecycle({ read, write, requestContext, now, ttlMs })`. Its `resolve({ roomId, roomLabel, roomMessages })` method returns `{ context, refreshStarted, state }`; stale contexts are returned immediately while one deduplicated refresh runs through the injected `requestContext` function.
- The service worker adds internal `getRoomContext(roomId)`, `ensureRoomContext(config, request)`, `refreshRoomContext(config, request, cachedEntry)`, and `startRoomContextRefresh(config, request, cachedEntry)` adapters around that lifecycle.
- Extend `TRANSLATE` input with `{ roomId, roomLabel, roomMessages, threadMessages }` while accepting the current `{ text, sourceLanguage, targetLanguage }` fields.
- Keep `GET_SETTINGS`, `SAVE_SETTINGS`, `SUMMARY`, `CLEAR_CACHE`, and `CACHE_STATS` response shapes backward compatible.

- [ ] **Step 1: Write failing cache and lifecycle tests**

```js
const oldContext = {
  key: "room-context:fixture-room",
  kind: "room-context",
  value: { roomId: "fixture-room", summary: "Old context", coveredMessageIds: ["m-1"], coveredFingerprint: "old" },
  expiresAt: 86_400_000
};
const newerMessages = [
  { id: "m-1", author: "A", time: "10:00", text: "Old" },
  { id: "m-2", author: "B", time: "10:01", text: "New" }
];

test("uses a distinct room-context cache namespace", () => {
  assert.match("room-context:fixture-room", /^room-context:/);
  assert.notEqual("room-context:fixture-room", "translation:fixture-room");
});

test("keeps the old context available while an expired refresh is in flight", async () => {
  const lifecycle = createRoomContextLifecycle({
    read: async () => oldContext,
    write: async () => {},
    requestContext: async () => ({ summary: "New context" }),
    now: () => 86_400_001,
    ttlMs: 86_400_000
  });
  const state = await lifecycle.resolve({ roomId: "fixture-room", roomLabel: "Fixture", roomMessages: newerMessages });
  assert.equal(state.context.summary, oldContext.value.summary);
  assert.equal(state.refreshStarted, true);
});

test("does not start two refreshes for the same room", async () => {
  let requests = 0;
  const lifecycle = createRoomContextLifecycle({
    read: async () => oldContext,
    write: async () => {},
    requestContext: async () => { requests += 1; return { summary: "New context" }; },
    now: () => 86_400_001,
    ttlMs: 86_400_000
  });
  const first = lifecycle.resolve({ roomId: "fixture-room", roomLabel: "Fixture", roomMessages: newerMessages });
  const second = lifecycle.resolve({ roomId: "fixture-room", roomLabel: "Fixture", roomMessages: newerMessages });
  await Promise.all([first, second]);
  assert.equal(requests, 1);
});
```

The lifecycle tests use the exported dependency-injected module directly. Do not mock provider behavior by asserting calls only; assert the returned context/fallback state and cache entries.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `node --test tests/unit/cache.test.js tests/unit/room-context.test.js`

Expected: FAIL because room-context cache lifecycle is not implemented.

- [ ] **Step 3: Implement cache lifecycle in the service worker**

Check translation cache before context work so cached translations do not create unnecessary context requests. For a missing context, build synchronously before the first context-aware translation. For an expired context, return the old summary immediately and start one deduplicated refresh. In append-only mode send the previous summary plus uncovered messages; on edit/delete/reorder rebuild from all loaded room messages. Redact every message before provider requests. Cache only successful context values with `kind: "room-context"`, the room key, coverage metadata, and 24-hour expiration.

- [ ] **Step 4: Verify failure fallback behavior**

Add tests for auth, rate-limit, server, timeout, malformed, and empty context responses. Assert that an existing context remains available and that a missing context falls back to the current simple translation path without caching an error.

- [ ] **Step 5: Run all unit tests**

Run: `npm run test:unit`

Expected: all unit tests PASS.

- [ ] **Step 6: Commit the service-worker lifecycle**

```bash
git add src/background/service-worker.js src/context/room-context.js tests/unit/cache.test.js tests/unit/room-context.test.js
git commit -m "feat: add incremental room context cache"
```

### Task 4: Collect Room and Thread Context in the Content Script

**Files:**
- Modify: `src/content/chat-observer.js`
- Modify: `src/content/message-text.js`
- Modify: `manifest.json` only if the new context helper is loaded as a content script.
- Modify: `tests/unit/message-text.test.js`
- Modify: `tests/fixtures/google-chat.html`

**Interfaces:**
- Add an internal `roomMessageData()` collector that returns only main-room messages, excluding injected UI and detailed-thread-only nodes.
- Add an internal `threadMessageData(threadId, targetNode)` collector that returns the complete currently loaded active-thread message set in chronological DOM order.
- Extend the `send({ type: "TRANSLATE" })` payload with `roomId`, `roomLabel`, `roomMessages`, and `threadMessages`.
- Keep `dataOf(node).text` as the target-only cleaned text.

- [ ] **Step 1: Add failing extraction tests and fixture data**

Add a fixture with:

- main-room messages defining a Japanese project term;
- a target thread message referring to that term indirectly;
- a child-thread reply;
- a quote wrapper containing Japanese content plus all three Vietnamese navigation labels;
- an edited and a deleted message control.

Assert that the collected provider request data contains clean room/thread messages and excludes quote content, labels, UI text, author metadata, timestamps, and injected translation text.

- [ ] **Step 2: Run the focused E2E test to verify the intended missing behavior**

Run: `npx playwright test tests/e2e/translation.spec.js -g "context"`

Expected: FAIL because the current `TRANSLATE` request contains only the target text.

- [ ] **Step 3: Implement collectors without changing rendered message layout**

Reuse the existing `messageNodes`, `dataOf`, `messageHost`, and quote-wrapper removal rules. Filter room history to main-stream nodes, filter thread history to the active thread, preserve chronological order, and never include `[data-tc-ui]` nodes. When no usable context text exists, send an empty list and let the service worker use fallback behavior.

- [ ] **Step 4: Run focused extraction and existing translation tests**

Run: `npm run test:unit && npx playwright test tests/e2e/translation.spec.js tests/e2e/security.spec.js`

Expected: all focused tests PASS and the original inline/child-thread/quote behavior remains unchanged.

- [ ] **Step 5: Commit content collection**

```bash
git add src/content/chat-observer.js src/content/message-text.js manifest.json tests/unit/message-text.test.js tests/fixtures/google-chat.html tests/e2e/translation.spec.js tests/e2e/security.spec.js
git commit -m "feat: send cleaned room and thread context"
```

### Task 5: Make the Provider Fixture and E2E Context Scenarios Deterministic

**Files:**
- Modify: `tests/fixtures/provider-server.js`
- Modify: `tests/e2e/translation.spec.js`
- Modify: `tests/e2e/resilience.spec.js`
- Modify: `tests/e2e/security.spec.js`
- Modify: `tests/e2e/helpers.js`

**Interfaces:**
- Provider fixture records every request and classifies it as `translation`, `room-context-initial`, or `room-context-refresh` by prompt markers.
- Helper exposes `app.provider.contextRequests()` and `app.provider.translationRequests()` without changing existing `requests` access.
- `launchConfiguredApp({ contextNow })` injects a deterministic clock into the extension test configuration, while product default remains 24 hours.
- The fixture adds `#add-room-message`, which appends `追加のroom message` to the loaded room without changing existing message controls.

- [ ] **Step 1: Write failing E2E scenarios**

Add tests with these names and assertions:

```js
test("uses room terminology and full thread history for a new translation", async () => {
  const app = await launchConfiguredApp({ autoTranslate: false });
  const message = app.page.locator("[data-message-id='m-1']");
  await message.locator("[data-tc-action]").click();
  const body = app.provider.translationRequests()[0].body;
  expect(body).toContain("ROOM CONTEXT:");
  expect(body).toContain("THREAD HISTORY:");
  expect(body).toContain("MESSAGE TO TRANSLATE:");
  expect(body).toContain("午後にトヨタで確認してもらいます。");
  await app.close();
});

test("reuses fresh room context without creating another context request", async () => {
  const app = await launchConfiguredApp({ autoTranslate: false });
  await app.page.locator("[data-message-id='m-1'] [data-tc-action]").click();
  await app.page.locator("[data-message-id='m-2'] [data-tc-action]").click();
  expect(app.provider.contextRequests()).toHaveLength(1);
  expect(app.provider.translationRequests()).toHaveLength(2);
  await app.close();
});

test("refreshes context incrementally after 24 hours", async () => {
  const app = await launchConfiguredApp({ autoTranslate: false, contextNow: 86_400_001 });
  await app.page.locator("#add-room-message").click();
  await app.page.locator("[data-message-id='m-1'] [data-tc-action]").click();
  const refreshBody = app.provider.contextRequests().find((request) => request.body.includes("ROOM CONTEXT CŨ")).body;
  expect(refreshBody).toContain("Old context");
  expect(refreshBody).toContain("追加のroom message");
  await app.close();
});
```

- [ ] **Step 2: Run the new E2E tests to verify they fail**

Run: `npx playwright test tests/e2e/translation.spec.js tests/e2e/resilience.spec.js -g "context|terminology|24 hours"`

Expected: FAIL because the provider fixture sees only the current target text and has no context request classification.

- [ ] **Step 3: Add deterministic provider responses**

Return a translation that depends on the fixture room term when the request includes the expected context marker. Return a compact context summary for initial and refresh prompts. Keep existing response branches for auth, rate-limit, server, timeout, malformed JSON, missing content, and XSS unchanged.

- [ ] **Step 4: Implement the helper seams and assertions**

Use a test-only clock injection or a context TTL override passed through the test helper; do not alter the product default of 24 hours. Assert request bodies rather than provider call counts alone, including the absence of quote labels and old thread text in the target section.

- [ ] **Step 5: Run all E2E tests**

Run: `npm run test:e2e`

Expected: all existing and new E2E tests PASS.

- [ ] **Step 6: Commit deterministic context E2E coverage**

```bash
git add tests/fixtures/provider-server.js tests/e2e/helpers.js tests/e2e/translation.spec.js tests/e2e/resilience.spec.js tests/e2e/security.spec.js
git commit -m "test: cover room and thread context translation"
```

### Task 6: Add Context Status and Manual Refresh UX

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.js`
- Modify: `src/content/chat-observer.js`
- Modify: `src/background/service-worker.js`
- Modify: `tests/e2e/settings.spec.js`

**Interfaces:**
- Add `GET_ROOM_CONTEXT_STATUS` and `REFRESH_ROOM_CONTEXT` runtime messages.
- Status response: `{ ok, roomId, state, generatedAt, expiresAt, error }`, where `state` is `unsupported`, `disabled`, `missing`, `ready`, `updating`, `stale`, or `error`.
- Manual refresh must use the active room only and must not enable a disabled room.

- [ ] **Step 1: Write failing popup tests**

Assert that the popup shows `Ngữ cảnh room`, renders `Chưa tạo` for an enabled room without context, and exposes `Cập nhật ngữ cảnh`. After context creation, assert `Sẵn sàng` and a last-updated timestamp. When refresh fails, assert `Dùng context cũ` or the safe error state without hiding the room toggle.

- [ ] **Step 2: Run the focused settings test to verify it fails**

Run: `npx playwright test tests/e2e/settings.spec.js -g "ngữ cảnh|context"`

Expected: FAIL because the popup has no context status or refresh control.

- [ ] **Step 3: Implement the smallest non-intrusive status UI**

Add a status block below room enablement, keep it compact, and update it from the active tab. The content script/service worker must report state changes without injecting the room summary into Google Chat. Manual refresh starts one deduplicated refresh and updates the status to `Đang cập nhật`.

- [ ] **Step 4: Run settings and regression E2E tests**

Run: `npx playwright test tests/e2e/settings.spec.js tests/e2e/translation.spec.js tests/e2e/summary.spec.js`

Expected: all popup, translation, child-thread, and summary tests PASS.

- [ ] **Step 5: Commit UX status**

```bash
git add src/popup/popup.html src/popup/popup.js src/content/chat-observer.js src/background/service-worker.js tests/e2e/settings.spec.js
git commit -m "feat: show room context status"
```

### Task 7: Add Large-History Chunking and Resilience Coverage

**Files:**
- Modify: `src/context/room-context.js`
- Modify: `src/background/service-worker.js`
- Modify: `src/provider/openai-compatible.js`
- Modify: `tests/unit/room-context.test.js`
- Modify: `tests/e2e/resilience.spec.js`
- Modify: `tests/fixtures/provider-server.js`

**Interfaces:**
- Add `chunkContextMessages(messages, maxChars)` with deterministic chronological chunks.
- Add `buildRoomContextMergeMessages(chunkSummaries, roomLabel)`.
- Keep the normal append-only daily refresh to one provider request when delta fits the safe input budget.

- [ ] **Step 1: Write failing chunk and fallback tests**

Assert that a long initial history becomes deterministic chunks, that chunk summaries are merged in order, and that a failed chunk/merge leaves no partial context cache. Add an E2E provider scenario where context creation fails but translation still renders through the simple fallback.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `node --test tests/unit/room-context.test.js && npx playwright test tests/e2e/resilience.spec.js -g "context"`

Expected: FAIL because long-history chunking and context-specific fallback branches are absent.

- [ ] **Step 3: Implement deterministic chunking and safe merge**

Use a fixed character budget lower than the provider limit, never split a message in the middle, and preserve message order. Cache only the final merged context. If any provider call fails, discard partial summaries and use the previous context or simple translation fallback.

- [ ] **Step 4: Run the full resilience suite**

Run: `npx playwright test tests/e2e/resilience.spec.js`

Expected: all provider exception scenarios and context fallback tests PASS.

- [ ] **Step 5: Commit large-history resilience**

```bash
git add src/context/room-context.js src/background/service-worker.js src/provider/openai-compatible.js tests/unit/room-context.test.js tests/e2e/resilience.spec.js tests/fixtures/provider-server.js
git commit -m "feat: handle large room context histories"
```

### Task 8: Update Documentation and Perform Release Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/test-report.md`
- Create or update: `docs/screenshots/06-room-context-status.png` only if the existing screenshot workflow can capture the new popup state without real account data.

- [ ] **Step 1: Document the user-visible behavior**

Add Vietnamese README sections explaining that the first room context uses currently loaded room history, refreshes incrementally about once per day, sends full loaded thread history as translation context, and never translates quote content.

- [ ] **Step 2: Capture deterministic UX evidence**

Run the existing screenshot script after adding a fixture status state. Do not capture real Google Chat content, credentials, API keys, or production room history.

- [ ] **Step 3: Update the test report**

Record unit/E2E counts, room-context initial/reuse/refresh tests, quote exclusion, fallback behavior, and the known limitation that Google Chat only exposes currently loaded history.

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: all unit and E2E tests pass, `git diff --check` is silent, and only intentional documentation or generated screenshot changes remain before the final commit.

- [ ] **Step 5: Commit documentation and verification evidence**

```bash
git add README.md docs/test-report.md docs/screenshots/06-room-context-status.png
git commit -m "docs: document context-aware translation"
```

## Final Review Checklist

- [ ] The implementation follows the approved spec at `docs/superpowers/specs/2026-09-19-context-aware-translation-design.md`.
- [ ] Room context is generated from all currently loaded room messages once initially.
- [ ] Normal daily refresh combines old context with uncovered new messages.
- [ ] Non-append edits/deletes trigger a rebuild rather than a blind merge.
- [ ] Every uncached translation receives room context, full loaded thread context, and a separate target message.
- [ ] Quote content and all quote wrapper labels are absent from provider requests.
- [ ] Context refresh is deduplicated and never blocks a translation using stale context.
- [ ] Raw room history is never written to local storage.
- [ ] Provider failures preserve old context or fall back safely.
- [ ] Room allowlist, child threads, inline layout, summary, cache, and existing error behavior remain green.
- [ ] `npm test` and `git diff --check` pass immediately before completion.
