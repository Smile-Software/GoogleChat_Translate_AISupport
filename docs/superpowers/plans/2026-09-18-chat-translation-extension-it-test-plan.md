# Google Chat AI Translation Extension Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Build and verify Chrome MV3 Google Chat translation and thread-summary extension with complete IT coverage before release.

Architecture: Content script owns Google Chat DOM observation and private UI injection. Service worker owns OpenAI-compatible provider calls, sanitization, settings, and IndexedDB cache access. Options page owns configuration. Tests use deterministic local Google Chat and 9router-compatible mock servers.

Tech Stack: Chrome Manifest V3, JavaScript ESM without bundler, DOM APIs, IndexedDB, chrome.storage.local, node:test for pure logic, Playwright for extension E2E.

## Global Constraints

- Translation and summary use the configured OpenAI-compatible provider; Google Translate API is out of MVP.
- Default target language is Tiếng Việt.
- Model IDs containing luna sort first; user can select or enter an exact model ID.
- Summary refresh is manual in MVP.
- Summary renders in private extension UI; never send a Google Chat message.
- API keys stay in chrome.storage.local and never chrome.storage.sync.
- Credential masking stays enabled by default.
- Cache TTL defaults to 7 days.
- Tests must not use production Google Chat, production 9router, real API keys, or room content.
- Original message text must remain visible when translation fails.

## Planned File Map

### Extension source

- Create: manifest.json - MV3 manifest, permissions, content script, service worker, options page.
- Create: src/content/chat-observer.ts - message/thread discovery and MutationObserver lifecycle.
- Create: src/content/message-ui.ts - inline translation controls and rendered states.
- Create: src/content/summary-ui.ts - private summary card and stale state.
- Create: src/content/chat-menu.ts - three-dot menu action injection.
- Create: src/background/service-worker.ts - runtime message router and provider orchestration.
- Create: src/provider/openai-compatible.ts - models and chat request client.
- Create: src/security/redact.ts - credential masking and warning metadata.
- Create: src/cache/indexed-db.ts - versioned cache schema and TTL cleanup.
- Create: src/settings/schema.ts - validated settings and defaults.
- Create: src/options/options.html - Settings page structure.
- Create: src/options/options.ts - Settings interactions and validation.
- Create: src/popup/popup.html - compact popup controls.
- Create: src/popup/popup.ts - popup state and actions.

### Test support

- Create: tests/unit/redact.test.ts
- Create: tests/unit/provider.test.ts
- Create: tests/unit/cache.test.ts
- Create: tests/unit/settings.test.ts
- Create: tests/unit/summary-fingerprint.test.ts
- Create: tests/fixtures/google-chat.html
- Create: tests/fixtures/provider-server.ts
- Create: tests/e2e/translation.spec.ts
- Create: tests/e2e/summary.spec.ts
- Create: tests/e2e/settings.spec.ts
- Create: tests/e2e/security.spec.ts
- Create: tests/e2e/resilience.spec.ts
- Create: playwright.config.js
- Create: package.json

## Test Strategy

### Test levels

| Level | Tool | Scope | Gate |
|---|---|---|---|
| Unit | node:test | Pure redaction, cache keys, settings, provider parsing, summary fingerprint | Every commit |
| Component | Playwright page fixture | DOM observer, message controls, menu action, private card | Every feature task |
| Integration | Playwright extension + mock provider | Service worker, cache, provider, UI together | Every feature task |
| E2E | Playwright Chromium | User flows across popup, Chat fixture, settings, stale summary | Before release |
| Security | Playwright + mock request recorder | No secret leakage, no Chat post, local-only key storage | Before release |
| Compatibility | Manual matrix + Playwright Chromium versions | Chrome supported versions, zoom, viewport, locale | Release candidate |

### Test data

- Japanese source: 午後にトヨタで確認してもらいます。少々お待ちください
- Vietnamese output: Chiều nay tôi sẽ nhờ Toyota kiểm tra. Vui lòng chờ một chút.
- Thread messages: ordered parent plus replies, stable IDs m-1, m-2, m-3.
- Credential fixture: Password: SECRET_VALUE, Authorization: Bearer TEST_TOKEN, api_key=TEST_KEY.
- Provider responses: valid translation, valid summary, model list with luna, 429, 500, timeout, malformed JSON, missing content.

## Test Case Matrix

### A. Settings and provider configuration

| ID | Priority | Setup / Steps | Expected |
|---|---|---|---|
| CFG-001 | P0 | Open Settings with empty storage | Defaults show target Tiếng Việt, TTL 7 days, masking on, manual summary refresh |
| CFG-002 | P0 | Enter valid Base URL and API key; save | Values persist in chrome.storage.local; key displays masked after reload |
| CFG-003 | P0 | Leave Base URL empty; save | Inline validation blocks save; no provider request |
| CFG-004 | P0 | Enter malformed URL; save | Inline validation blocks save; error names URL field |
| CFG-005 | P0 | Enter whitespace-only key; save | Inline validation blocks save |
| CFG-006 | P0 | Save settings, inspect chrome.storage.sync | No API key or settings written to sync storage |
| CFG-007 | P0 | Click Test connection with valid mock provider | Success state shows provider reachable and model count |
| CFG-008 | P0 | Click Test connection with 401 mock response | Error shows authentication failure; key value not logged or rendered |
| CFG-009 | P1 | Click Test connection with timeout | Error shows timeout and retry action; UI remains usable |
| CFG-010 | P0 | Load model list [alpha, luna-fast, luna-pro, beta] | Selector order is luna-fast, luna-pro, alpha, beta |
| CFG-011 | P0 | Enter exact custom model ID not returned by /models | Custom ID saves and appears selected |
| CFG-012 | P1 | Provider returns duplicate or invalid model IDs | UI removes duplicates and ignores empty IDs |
| CFG-013 | P1 | Set request timeout to min, max, invalid values | Valid range saves; invalid values blocked with field error |
| CFG-014 | P1 | Reload Settings after successful save | All saved values restore without API call |
| CFG-015 | P1 | Click reset defaults and confirm | Defaults restore; API key remains cleared only after explicit confirmation |

### B. Translation UX and behavior

| ID | Priority | Setup / Steps | Expected |
|---|---|---|---|
| TR-001 | P0 | Open fixture with Japanese message | Inline translation action appears; original remains unchanged |
| TR-002 | P0 | Click translate on one message | Loading state appears, then Vietnamese text renders below original |
| TR-003 | P0 | Translate Vietnamese message | Addon does not create duplicate Vietnamese translation by default |
| TR-004 | P0 | Translate English message with auto source | Provider receives source text and target language; result renders |
| TR-005 | P0 | Select English target in popup; translate Japanese message | English output renders; original stays visible |
| TR-006 | P0 | Select target language A, then B | B uses separate cache key and replaces only translation layer |
| TR-007 | P0 | Re-scan unchanged message | Provider request count does not increase |
| TR-008 | P0 | Reload fixture with same message | Cached translation renders without provider request |
| TR-009 | P0 | Edit message text | New hash triggers new request; stale translation is not shown as current |
| TR-010 | P0 | Add three new messages quickly | Observer debounces; each unique message gets at most one request |
| TR-011 | P1 | Click hide original | Original hides; restore control brings it back |
| TR-012 | P1 | Click remove translation | Translation layer clears; cache entry remains until TTL or clear |
| TR-013 | P0 | Provider returns 429 | Original remains; inline error offers retry; failed result is not cached |
| TR-014 | P0 | Provider returns malformed response | Original remains; generic error shown; raw response not rendered |
| TR-015 | P1 | Provider timeout | Timeout state appears; retry starts one request only |
| TR-016 | P1 | Message contains link, emoji, line breaks | Text structure is safe and readable; no HTML injection |
| TR-017 | P0 | Message contains credential-like text | Outbound payload contains mask placeholder, never secret value |
| TR-018 | P0 | Extension disabled from popup | Existing translation UI hides or stops updating; no new provider request |
| TR-019 | P1 | Toggle show original off in Settings | New and existing translations follow setting without page reload |
| TR-020 | P1 | Use Chrome zoom 80%, 100%, 150% | Controls remain clickable and text does not overlap |

### C. Thread summary

| ID | Priority | Setup / Steps | Expected |
|---|---|---|---|
| SUM-001 | P0 | Open three-dot menu for threaded parent | Menu contains Tóm tắt thread bằng AI once |
| SUM-002 | P0 | Click summary action | Private summary card opens; no Google Chat composer or sent message appears |
| SUM-003 | P0 | Mock valid summary response | Card shows summary, model ID, and updated time |
| SUM-004 | P0 | Refresh page after cached summary exists | Summary restores from cache without provider request |
| SUM-005 | P0 | Open same thread from another message | Same cached summary is reused |
| SUM-006 | P0 | Add two replies after summary | Card stays visible and shows Có 2 message mới |
| SUM-007 | P0 | Click Cập nhật after new replies | Request contains old summary plus only new replies; card updates and stale badge clears |
| SUM-008 | P0 | Edit existing reply | Incremental update is disabled; full-thread request is sent |
| SUM-009 | P0 | Delete reply | Incremental update is disabled; full-thread request is sent |
| SUM-010 | P0 | Message IDs unavailable | Fingerprint falls back to author, time, and normalized text; duplicate summaries are avoided |
| SUM-011 | P0 | Provider returns error | Old summary remains; card shows retry and stale state |
| SUM-012 | P1 | Click Copy | Clipboard contains summary only; no raw thread text unless summary includes it |
| SUM-013 | P1 | Click Close | Card disappears; no Chat DOM message is added |
| SUM-014 | P0 | Open summary for unthreaded message | Menu item hidden or disabled with clear reason |
| SUM-015 | P0 | Summary output includes HTML-like text | Card renders text safely, never executes markup |
| SUM-016 | P1 | Set summary language and length in Settings | New summary uses selected language and length |
| SUM-017 | P1 | Enable automatic refresh setting | New message triggers one debounced refresh; setting remains off by default |
| SUM-018 | P1 | Open two threads in separate panels | Each card tracks its own thread ID, cache key, and stale state |

### D. Popup and Settings UX

| ID | Priority | Setup / Steps | Expected |
|---|---|---|---|
| UX-001 | P0 | Click extension icon | Compact popup opens within 500 ms |
| UX-002 | P0 | Change target language in popup | Selection saves and content script receives update |
| UX-003 | P0 | Change model in popup | Selected model persists and is used by next request |
| UX-004 | P1 | Provider not configured | Popup shows setup state and link to Settings |
| UX-005 | P1 | Cache has entries | Popup shows count/size without displaying raw message content |
| UX-006 | P0 | Click clear translation cache | Confirmation appears; only translation cache is deleted |
| UX-007 | P0 | Click clear summary cache | Confirmation appears; only summary cache is deleted |
| UX-008 | P1 | Click Settings link | Options page opens in a full tab |
| UX-009 | P1 | Close popup by clicking Chat | Chat remains responsive; selected settings are saved |
| UX-010 | P1 | Keyboard navigate popup | All controls reachable and have accessible names |
| UX-011 | P1 | Screen reader inspect inline translation | Original, translation, loading, error, and stale states have labels |

### E. Cache and data lifecycle

| ID | Priority | Setup / Steps | Expected |
|---|---|---|---|
| CACHE-001 | P0 | Write translation entry, read same key | Exact result returned |
| CACHE-002 | P0 | Read missing key | Cache miss returns null/none without exception |
| CACHE-003 | P0 | Store same source with two targets | Entries remain independent |
| CACHE-004 | P0 | Advance clock beyond 7-day TTL | Expired entry ignored and removed during cleanup |
| CACHE-005 | P1 | Set 1-day and 30-day TTL | Expiry follows current setting for newly written entries |
| CACHE-006 | P0 | Clear translation cache | Translation records deleted; summary records remain |
| CACHE-007 | P0 | Clear summary cache | Summary records deleted; translation records remain |
| CACHE-008 | P1 | IndexedDB unavailable or blocked | UI shows cache unavailable; provider flow still works without cache |
| CACHE-009 | P1 | Cache value contains HTML-like text | Read path returns text only; UI escapes it |
| CACHE-010 | P1 | Browser restart simulation | Non-expired cache survives; expired cache does not render |

### F. Security and privacy

| ID | Priority | Setup / Steps | Expected |
|---|---|---|---|
| SEC-001 | P0 | Translate Password: SECRET_VALUE | Recorder sees Password: [REDACTED]; secret absent |
| SEC-002 | P0 | Translate bearer token fixture | Full token absent from request, logs, DOM, and cache |
| SEC-003 | P0 | Translate URL with query credential | Sensitive query value masked; URL structure preserved where safe |
| SEC-004 | P0 | Inspect service-worker console after requests | No API key, raw credential, or full message body logged |
| SEC-005 | P0 | Search DOM after summary | No hidden real Chat message contains summary text |
| SEC-006 | P0 | Inspect network after Chat interaction | No request posts translation or summary to Google Chat |
| SEC-007 | P0 | Inspect extension permissions | Only required Google Chat/provider permissions exist |
| SEC-008 | P0 | Attempt provider URL not in allowed configuration | Request is blocked or requires explicit configured host |
| SEC-009 | P0 | Read chrome.storage.sync | API key absent |
| SEC-010 | P1 | Clear cache | IndexedDB contains no translation/summary records |
| SEC-011 | P1 | XSS payload in source/provider response | No script executes; rendered output is text |
| SEC-012 | P0 | Provider request fails | Error does not reveal API key or raw provider response |

### G. Resilience and compatibility

| ID | Priority | Setup / Steps | Expected |
|---|---|---|---|
| RES-001 | P0 | Google Chat adds unknown wrapper around message | Observer still finds supported message or safely skips it |
| RES-002 | P0 | Google Chat changes class names in fixture variant | Semantic fallback works; diagnostic code is non-sensitive |
| RES-003 | P0 | Virtualized list removes off-screen messages | Cache remains; reappearing message restores translation |
| RES-004 | P1 | Rapid scroll through 100 messages | No duplicate requests per cache key; UI remains responsive |
| RES-005 | P1 | Provider returns 500 then success | Retry succeeds once; error state clears |
| RES-006 | P0 | Provider returns 429 with Retry-After | UI waits or offers retry; no tight retry loop |
| RES-007 | P1 | Network disconnect during request | Original message stays; retry works after reconnect |
| RES-008 | P1 | Extension service worker restarts | Pending UI recovers to idle/error; settings and cache remain |
| RES-009 | P1 | Thread panel closes during summary request | Request result does not inject into wrong thread |
| RES-010 | P1 | Two simultaneous translations | Responses render into correct message IDs |
| RES-011 | P1 | Chrome locale Vietnamese and English | Labels use selected locale without clipped controls |
| RES-012 | P1 | Light/dark Google Chat theme | Contrast and borders remain usable |

### H. Performance and cost controls

| ID | Priority | Setup / Steps | Expected |
|---|---|---|---|
| PERF-001 | P0 | Open room with 100 messages | Initial observer setup completes without blocking Chat input |
| PERF-002 | P0 | Re-render same 100 messages | Provider request count remains bounded by unique cache keys |
| PERF-003 | P1 | Add five messages in 1 second | Debounce coalesces work; each message receives one result |
| PERF-004 | P0 | Refresh summary with five new replies | Incremental payload excludes unchanged thread body |
| PERF-005 | P1 | Open popup repeatedly | Popup opens within 500 ms with no duplicate listeners |
| PERF-006 | P1 | Cache hit translation | Result appears without visible loading spinner after cache read |
| PERF-007 | P1 | 429 storm simulation | Backoff prevents request loop and exposes retry action |
| PERF-008 | P1 | Record request sizes | Summary update payload is smaller than full-thread payload when only new messages exist |

## Execution Order

### Task 1: Test harness and fixtures

Files:

- Create: package.json
- Create: playwright.config.js
- Create: tests/fixtures/google-chat.html
- Create: tests/fixtures/provider-server.ts

- [ ] Add scripts for unit, component, E2E, and security suites.
- [ ] Build fixture with semantic message groups, three-dot menu, threaded replies, message insertion, edit, delete, and virtualized removal.
- [ ] Build mock provider recorder with /models, valid chat responses, 401, 429, 500, timeout, malformed JSON, and request capture.
- [ ] Run the empty harness and verify browser fixture loads.

### Task 2: Pure logic gates

Files:

- Create: src/security/redact.ts
- Create: src/cache/indexed-db.ts
- Create: src/settings/schema.ts
- Create: src/provider/openai-compatible.ts
- Create: tests/unit/redact.test.ts
- Create: tests/unit/cache.test.ts
- Create: tests/unit/settings.test.ts
- Create: tests/unit/provider.test.ts
- Create: tests/unit/summary-fingerprint.test.ts

- [ ] Write failing tests for SEC-001..SEC-004, CACHE-001..CACHE-010, CFG-001..CFG-015, provider parsing, and summary fingerprints.
- [ ] Implement minimal pure functions and IndexedDB adapter.
- [ ] Run node --test suite; require zero failures and no console output containing fixture secrets.

### Task 3: Translation component

Files:

- Create: src/content/chat-observer.ts
- Create: src/content/message-ui.ts
- Create: src/background/service-worker.ts
- Create: tests/e2e/translation.spec.ts

- [ ] Add failing tests for TR-001..TR-020, RES-001..RES-004, and PERF-001..PERF-003.
- [ ] Implement message extraction, debounced observer, cache lookup, provider request, and inline UI states.
- [ ] Run translation suite and verify recorder request counts.

### Task 4: Summary component

Files:

- Create: src/content/chat-menu.ts
- Create: src/content/summary-ui.ts
- Modify: src/content/chat-observer.ts
- Create: tests/e2e/summary.spec.ts

- [ ] Add failing tests for SUM-001..SUM-018.
- [ ] Implement three-dot menu action, private card, fingerprinting, stale badge, incremental update, and full-thread fallback.
- [ ] Run summary suite and verify no Chat composer/message mutation.

### Task 5: Popup and Settings

Files:

- Create: src/options/options.html
- Create: src/options/options.ts
- Create: src/popup/popup.html
- Create: src/popup/popup.ts
- Create: tests/e2e/settings.spec.ts

- [ ] Add failing tests for CFG-001..CFG-015 and UX-001..UX-011.
- [ ] Implement four Settings groups, masked key handling, model sorting, popup controls, cache actions, and accessible labels.
- [ ] Run settings suite at 80%, 100%, and 150% zoom.

### Task 6: Security and resilience gates

Files:

- Modify: src/background/service-worker.ts
- Modify: src/security/redact.ts
- Create: tests/e2e/security.spec.ts
- Create: tests/e2e/resilience.spec.ts

- [ ] Add failing tests for SEC-001..SEC-012 and RES-001..RES-012.
- [ ] Implement host allowlist, safe rendering, retry/backoff, service-worker restart recovery, stale-thread guard, and non-sensitive diagnostics.
- [ ] Run security suite with request recorder and inspect storage/network assertions.

### Task 7: Release verification

Files:

- Modify: manifest.json
- Modify: playwright.config.ts
- Create: docs/test-report.md

- [ ] Run all unit and E2E suites against a clean profile.
- [ ] Run manual compatibility matrix: Chrome stable, 80/100/150% zoom, light/dark theme, Vietnamese/English browser locale, viewport width 1280 and 390.
- [ ] Confirm P0 and P1 cases pass; any lower-priority failure gets a documented workaround.
- [ ] Record test counts, environment, provider mock version, and known limitations in docs/test-report.md.
- [ ] Verify no real credential, API key, production room URL, or production provider URL exists in source, fixtures, logs, or test report.

## Release Exit Criteria

- All P0 cases pass.
- At least 95% of P1 cases pass; failures have approved workaround and documented risk.
- No SEC-001 through SEC-012 failure.
- No unhandled provider request loop under 429, 500, timeout, or malformed response.
- No summary is posted to Google Chat.
- No API key appears in chrome.storage.sync, DOM, logs, screenshots, or test artifacts.
- Translation cache and summary cache clear independently.
- Summary stale state is visible after new thread messages.
- Clean-profile E2E run passes twice consecutively.

## Self-review

- Scope covers translation, summary, popup, Settings, cache, security, DOM resilience, performance, and release verification.
- No production room or provider is used by tests.
- Summary update logic covers new, edited, deleted, and ID-less messages.
- Every planned source unit has unit/component/E2E coverage or an explicit fixture boundary.
- Test plan contains no placeholder task or unnamed edge-case requirement.
