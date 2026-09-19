# TranslateChat Resilience, Test, and Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand exception coverage, refactor provider/UI error handling without changing approved UX, verify the full extension, and publish a README with deterministic screenshots.

**Architecture:** Keep the existing MV3 boundaries. Normalize provider failures at the provider boundary, let the service worker return safe structured errors, and centralize content-side async state transitions in small helpers used by translation and summary flows. Extend the local provider and Chat fixtures so every failure is deterministic and retryable only by explicit user action.

**Tech Stack:** Chrome MV3, JavaScript ESM, `node:test`, Playwright 1.63, local HTTP fixtures, Markdown, PNG screenshots.

## Global Constraints

- Do not call production Google Chat, production 9router, or any real API key.
- Keep translation and summary on the configured OpenAI-compatible provider.
- Keep original Google Chat text visible when translation or summary fails.
- Render provider output with `textContent`; never inject provider HTML.
- Do not add automatic retry loops.
- Keep room allowlist gating and child-thread auto-translation behavior unchanged.
- Do not include secrets, real room content, or credentials in screenshots or docs.

---

### Task 1: Normalize provider failures with unit coverage

**Files:**
- Modify: `src/provider/openai-compatible.js`
- Modify: `src/background/service-worker.js`
- Modify: `tests/unit/provider.test.js`
- Create: `tests/unit/provider-errors.test.js`

**Interfaces:**
- Produces `ProviderError` with `code`, `status`, `retryable`, and `userMessage`.
- `requestJson()` converts HTTP, abort, network, malformed JSON, and invalid response errors into `ProviderError`.
- Service-worker responses keep `{ ok: false, error, status }` compatible with existing callers and add `code` and `retryable` when available.

- [ ] **Step 1: Write failing unit tests** for 401 authentication, 429 rate limit, 500 server error, timeout abort, network rejection, malformed JSON, and missing completion content.
- [ ] **Step 2: Run the focused unit tests** with `node --test tests/unit/provider-errors.test.js tests/unit/provider.test.js`; confirm each failure is caused by the missing normalized contract.
- [ ] **Step 3: Implement `ProviderError` and classification** in `src/provider/openai-compatible.js`; preserve the current successful model-list and chat-completion behavior.
- [ ] **Step 4: Return structured errors from the service worker** without exposing raw provider bodies or credentials.
- [ ] **Step 5: Re-run provider unit tests** and then `npm run test:unit`.

### Task 2: Refactor content request states and extend deterministic fixtures

**Files:**
- Create: `src/content/operation-state.js`
- Modify: `src/content/chat-observer.js`
- Modify: `tests/fixtures/provider-server.js`
- Modify: `tests/fixtures/google-chat.html`
- Modify: `tests/e2e/helpers.js`
- Create: `tests/unit/operation-state.test.js`

**Interfaces:**
- `runUiOperation({ request, onLoading, onSuccess, onError, isCurrent })` runs one explicit operation and ignores stale results.
- `startProviderServer()` exposes `failNext(scenario)` and records every request.
- Supported fixture scenarios are `auth`, `rate-limit`, `server`, `timeout`, `malformed-json`, `missing-content`, and `xss`.

- [ ] **Step 1: Write failing unit tests** for operation success, safe error conversion, and stale-result suppression.
- [ ] **Step 2: Run `node --test tests/unit/operation-state.test.js`** and confirm the helper behavior is not implemented.
- [ ] **Step 3: Implement the small operation-state helper** with no DOM dependency and no retry loop.
- [ ] **Step 4: Refactor translation and summary flows** to use the helper, preserve the original message on errors, preserve an existing summary on refresh errors, and ignore responses after a message/card is removed.
- [ ] **Step 5: Add provider fixture failure queues** and Chat fixture controls for room off, duplicate scan, XSS response, child thread, edit, delete, and add-reply cases.
- [ ] **Step 6: Run unit tests and the existing translation/summary/security E2E files** before adding new resilience assertions.

### Task 3: Add resilience and exception E2E coverage

**Files:**
- Create: `tests/e2e/resilience.spec.js`
- Modify: `tests/e2e/translation.spec.js`
- Modify: `tests/e2e/summary.spec.js`
- Modify: `tests/e2e/security.spec.js`
- Modify: `tests/e2e/settings.spec.js`

**Interfaces:**
- Each test uses `launchConfiguredApp()` with a fresh persistent context and the local provider recorder.
- Failure tests enqueue one provider failure, assert the safe UI state, then explicitly retry and assert one successful follow-up request.

- [ ] **Step 1: Add failing E2E tests** for missing configuration, auth/rate-limit/server/timeout/malformed/missing-content failures, translation retry, summary retry with old summary preserved, and XSS-safe rendering.
- [ ] **Step 2: Add failing E2E tests** for room disabled/enabled behavior, duplicate scan request bounds, child-thread replies, and message removal while a request is pending.
- [ ] **Step 3: Run `npx playwright test tests/e2e/resilience.spec.js`** and confirm failures identify missing behavior rather than fixture setup errors.
- [ ] **Step 4: Adjust only implementation or fixture behavior required by the tests**; keep assertions user-visible and request-count based.
- [ ] **Step 5: Run `npm run test:e2e`** and inspect all failure traces if any test fails.

### Task 4: Update test matrix, test report, and user README

**Files:**
- Modify: `docs/superpowers/plans/2026-09-18-chat-translation-extension-it-test-plan.md`
- Modify: `docs/test-report.md`
- Create: `README.md`
- Create: `docs/screenshots/.gitkeep`

**Interfaces:**
- The IT plan records the new resilience IDs and maps them to executable unit/E2E files.
- The report records fresh command output, counts, environment, and known limitations.
- README steps match the actual manifest, Settings fields, popup labels, room toggle flow, cache behavior, and test scripts.

- [ ] **Step 1: Add explicit test IDs** for provider failures, safe rendering, stale-result guards, room gating, child-thread auto-translation, and cache fallback.
- [ ] **Step 2: Draft README** with install, configure, use, troubleshooting, privacy, cache, and test sections.
- [ ] **Step 3: Add screenshot links** using the final `docs/screenshots/*.png` filenames without claiming live production screenshots.
- [ ] **Step 4: Self-review docs** for secrets, stale test counts, broken paths, and instructions that do not match the UI.

### Task 5: Capture deterministic screenshots and verify the release

**Files:**
- Create: `scripts/capture-readme-screenshots.mjs`
- Create: `docs/screenshots/01-settings.png`
- Create: `docs/screenshots/02-inline-translation.png`
- Create: `docs/screenshots/03-child-thread.png`
- Create: `docs/screenshots/04-summary-card.png`
- Create: `docs/screenshots/05-provider-error.png`
- Modify: `docs/test-report.md`

**Interfaces:**
- The capture script launches the existing local fixture and provider, configures only deterministic test values, captures the five named states, and closes all servers/contexts in `finally`.

- [ ] **Step 1: Implement the capture script** using Playwright locators and no arbitrary sleeps.
- [ ] **Step 2: Run the script** and verify each PNG exists and contains only fixture text.
- [ ] **Step 3: Inspect screenshots** with the local image viewer and fix capture state or layout if any image is blank, clipped, or misleading.
- [ ] **Step 4: Run syntax checks** with `node --check` on all changed JavaScript files.
- [ ] **Step 5: Run `npm test` twice** from a clean fixture state; require zero failures both times.
- [ ] **Step 6: Update `docs/test-report.md`** with final unit/E2E counts, exception scenarios, screenshot paths, and any remaining limitation.

## Final verification checklist

- [ ] `npm run test:unit` passes.
- [ ] `npm run test:e2e` passes.
- [ ] `npm test` passes twice consecutively.
- [ ] No provider error body, API key, token, or real room data appears in DOM, README, screenshots, or test output.
- [ ] README installation and room-toggle instructions work against the current extension files.
- [ ] Child-thread translation and private summary behavior remain covered after refactoring.
