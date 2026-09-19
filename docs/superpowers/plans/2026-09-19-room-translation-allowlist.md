# Room Translation Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users explicitly enable TranslateChat per Google Chat room and keep every other room untouched.

**Architecture:** Store a normalized `roomAllowlist` in `chrome.storage.local`. The content script detects the active room, owns the room gate and DOM cleanup, and exposes room status/toggle messages to the popup. The static dump demo mirrors the same UX with an in-memory room switch.

**Tech Stack:** Chrome Manifest V3, vanilla JavaScript ES modules, `chrome.storage.local`, DOM APIs, Node `node:test`, Playwright for existing manual fixture checks.

## Global Constraints

- All rooms are disabled by default; the existing global `enabled` switch remains a master switch.
- A disabled room receives no TranslateChat UI and no provider request.
- Room state is stored only in `chrome.storage.local`.
- The demo stays local-only and does not call any provider.
- Do not modify the original dump in `/Users/vudn/Downloads/html/`.
- Do not run the full automated test suite for the demo; use focused unit verification and manual browser checks.

### Task 1: Add pure room allowlist helpers

**Files:**
- Create: `src/settings/rooms.js`
- Create: `tests/unit/rooms.test.js`
- Modify: `src/settings/schema.js`

**Interfaces:**
- `normalizeRoomAllowlist(value): object`
- `isRoomEnabled(settings, roomId): boolean`
- `setRoomEnabled(settings, roomId, label, enabled): object`

- [x] **Step 1: Write failing unit tests** for malformed entries, default-off behavior, enabling, and removing a room.
- [x] **Step 2: Run `node --test tests/unit/rooms.test.js` and confirm the expected import/function failure.**
- [x] **Step 3: Implement the helpers and add `roomAllowlist: {}` to normalized settings.
- [x] **Step 4: Run the focused unit test again and confirm it passes.

### Task 2: Gate content-script behavior by the active room

**Files:**
- Modify: `src/content/chat-observer.js`
- Modify: `src/background/service-worker.js`

**Interfaces:**
- Content script handles `GET_ROOM_STATUS` and `SET_ROOM_ENABLED`.
- Service worker persists the normalized settings returned by `setRoomEnabled`.

- [x] **Step 1:** Add room ID/label detection from `/app/chat/<id>` and `/room/<id>` plus supported-page fallback attributes.
- [x] **Step 2:** Add `roomEnabled` state and a `refreshRoomGate()` path that clears `[data-tc-ui]` when disabled.
- [x] **Step 3:** Make `scan()`, translation, and summary menu injection no-op when the room is disabled.
- [x] **Step 4:** Recompute the room gate on SPA URL changes, DOM changes, storage changes, and popup toggle messages.
- [x] **Step 5:** Add runtime message handling for room status and room toggles.

### Task 3: Add room switch to popup and room management to Settings

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.js`
- Modify: `src/options/options.html`
- Modify: `src/options/options.js`

- [x] **Step 1:** Add popup room label/status and `Dịch room này` switch while preserving global enable, target, model, and cache actions.
- [x] **Step 2:** Load active-tab room status through `GET_ROOM_STATUS` and persist changes through `SET_ROOM_ENABLED`.
- [x] **Step 3:** Add an enabled-room list to Settings with room labels, IDs, and remove buttons.
- [x] **Step 4:** Keep unsupported tabs and unknown rooms disabled with clear status text.

### Task 4: Mirror the room toggle in the static demo

**Files:**
- Modify: `demo/translatechat-demo.js`
- Regenerate: `demo/TranslateChat-demo.html`
- Regenerate: `demo/TranslateChat-demo-package.zip`

- [x] **Step 1:** Add a local `roomAllowlist` and a visible `Dịch room này` switch, enabled for the captured room initially.
- [x] **Step 2:** Make the switch remove/recreate translation and summary controls without changing the dumped Chat DOM.
- [x] **Step 3:** Ensure the simulated new-message and summary stale states respect the room gate.
- [x] **Step 4:** Rebuild the standalone HTML and ZIP.

### Task 5: Manual verification and handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-09-19-room-translation-allowlist.md`

- [x] **Step 1:** Manually verify the demo starts enabled, disables cleanly, and restores the 16 main-message translations when re-enabled.
- [x] **Step 2:** Manually verify the extension fixture reports room status and does not inject UI while the room is off.
- [x] **Step 3:** Mark completed plan steps and report the demo/extension files for review.
