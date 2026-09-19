# Message Body Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Google Chat author/status metadata from being translated and place TranslateChat controls after the message body.

**Architecture:** Extract pure message-text cleanup into a small content helper. The content observer will use that helper for translation and summary data, and will mount controls in an extension-owned surface appended to the message node instead of the host action header.

**Tech Stack:** Chrome MV3 content script, vanilla JavaScript ES modules, Node test runner, Playwright E2E tests.

## Global Constraints

- Preserve the original host message and its existing controls.
- Never send localized external-user status, `domain_disabled`, author headers, or host action labels as message content.
- Keep translation and summary cache behavior compatible with existing namespaces.
- Use ASCII for new source comments and keep the existing project style.

---

### Task 1: Add failing message-cleanup tests

**Files:**
- Create: `tests/unit/message-text.test.js`
- Test: `src/content/message-text.js`

**Interfaces:**
- Produces `cleanMessageText(raw, options)` returning a trimmed message body string.

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { cleanMessageText } from "../../src/content/message-text.js";

test("removes external-user metadata but keeps Japanese message text", () => {
  const raw = "小野和夫\nNgười dùng bên ngoài không do quản trị viên quản lý\n午後にトヨタで確認してもらいます。少々お待ちください\nHôm qua 10:29";
  assert.equal(
    cleanMessageText(raw, { author: "小野和夫", time: "Hôm qua 10:29" }),
    "午後にトヨタで確認してもらいます。少々お待ちください"
  );
});

test("removes domain status and reply metadata from a short message", () => {
  const raw = "小野和夫, domain_disabled\n了解致しました\n1 tin nhắn trả lời, Câu trả lời cuối cùng Hôm qua 14:38";
  assert.equal(cleanMessageText(raw, { author: "小野和夫" }), "了解致しました");
});

test("does not remove an ordinary body sentence", () => {
  assert.equal(cleanMessageText("作業中 問題あり。teams参照して対応してください", { author: "小野和夫" }), "作業中 問題あり。teams参照して対応してください");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/message-text.test.js`

Expected: FAIL because `src/content/message-text.js` does not exist yet.

- [ ] **Step 3: Stop here until the failure is confirmed**

Do not modify the content observer before the focused test fails for the intended missing helper.

### Task 2: Implement text cleanup and integrate it

**Files:**
- Create: `src/content/message-text.js`
- Modify: `src/content/chat-observer.js:47-64,102-121`

**Interfaces:**
- `cleanMessageText(raw, { author, time } = {})` returns a string with host metadata removed.
- `dataOf(node)` uses `cleanMessageText` after the explicit `data-text` fast path.
- `ensureMessage(node)` appends a dedicated `[data-tc-surface]` after the host message node.

- [ ] **Step 1: Implement the minimal cleanup helper**

Implement these rules in order:

```js
export function cleanMessageText(raw, { author = "", time = "" } = {}) {
  let text = String(raw || "").replace(/\u00a0/g, " ");
  const externalStatus = /(?:Người dùng bên ngoài không do quản trị viên quản lý|External user not managed by admin|domain_disabled)/gi;
  text = text.replace(externalStatus, " ");
  if (author) text = text.replace(new RegExp("(?:^|[\\n,])\\s*" + escapeRegExp(author) + "\\s*(?=[,\\n]|$)", "g"), " ");
  if (time) text = text.replace(new RegExp("\\s*" + escapeRegExp(time) + "\\s*$", "g"), "");
  text = text.replace(/,?\s*\d+\s+(?:tin nhắn trả lời|replies?)\b.*$/gi, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}
```

The helper must export `escapeRegExp` only if the implementation needs it; otherwise keep it private.

- [ ] **Step 2: Run the focused test and verify GREEN**

Run: `node --test tests/unit/message-text.test.js`

Expected: 3 passing tests.

- [ ] **Step 3: Use cleaned text in the observer**

Import `cleanMessageText`, preserve `data-text` as the highest-priority source, and clean only DOM-derived text. Replace the `[data-message-actions]` anchor logic with:

```js
const surface = document.createElement("div");
surface.setAttribute(UI_ATTR, "");
surface.setAttribute("data-tc-surface", "");
surface.append(action, output);
node.append(surface);
```

- [ ] **Step 4: Add focused E2E assertions before changing unrelated behavior**

Extend `tests/e2e/security.spec.js` so a metadata-bearing message body is sent without `domain_disabled` or the localized external-user label.

### Task 3: Verify regressions and live behavior

**Files:**
- Modify: `tests/fixtures/google-chat.html` only if a fixture needs metadata coverage.
- Modify: `docs/test-report.md` with fresh results.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all unit and E2E tests pass.

- [ ] **Step 2: Reload the unpacked extension in Chrome profile `Đặng (Smile)`**

Use `chrome://extensions/` and the existing local TranslateChat extension. Reload the extension, then reload the Google Chat room.

- [ ] **Step 3: Verify the room visually**

Confirm the Japanese message remains readable, the green AI translation contains only Vietnamese content, and no extension-generated line contains `Người dùng bên ngoài không do quản trị viên quản lý` or `domain_disabled`.

- [ ] **Step 4: Record evidence**

Update `docs/test-report.md` with the test command, pass counts, and the live-room verification result without recording message contents or credentials.
