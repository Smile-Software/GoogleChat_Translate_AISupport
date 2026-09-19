# Chat Dump UX Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a review-only HTML demo that preserves the captured Google Chat page and adds TranslateChat interactions on top of the real message DOM.

**Architecture:** Copy the user-provided dump and its asset folder into a demo folder, then inject a small local-only overlay script. The overlay targets the captured Google Chat structure (`data-message-id`, `jsname="A9KrYd"`, and the body sibling under `F0wyae`) without calling any provider.

**Tech Stack:** Static HTML, vanilla JavaScript, CSS, local captured Google Chat assets.

## Global Constraints

- Do not call a provider or send captured message content anywhere.
- Do not modify the original dump in `/Users/vudn/Downloads/html/`.
- Preserve the captured Google Chat layout and original message text.
- Demo behavior is limited to inline translation preview, three-dot summary action, and new-message refresh state.
- Do not run automated tests for this demo.

### Task 1: Create the captured-page demo copy

**Files:**
- Create: `demo/chat-dump.html`
- Create: `demo/chat-dump_files/` copied from the user dump assets
- Create: `demo/translatechat-demo.js`

- [ ] **Step 1:** Copy the supplied dump and asset directory without changing the originals.
- [ ] **Step 2:** Inject the demo script and stylesheet into the copied HTML.
- [ ] **Step 3:** Add local-only click handlers for translation, summary, stale state, and reset.

### Task 2: Open the demo for visual review

**Files:**
- No source changes.

- [ ] **Step 1:** Serve the demo directory locally.
- [ ] **Step 2:** Open the generated page in the browser.
- [ ] **Step 3:** Confirm the captured layout is visible and the overlay controls are interactive.

### Task 3: Auto-translate main messages inline

**Files:**
- Modify: `demo/translatechat-demo.js`
- Regenerate: `demo/TranslateChat-demo.html`
- Regenerate: `demo/TranslateChat-demo-package.zip`

- [x] **Step 1:** Limit demo message discovery to the main conversation pane and exclude any message under `[data-is-detailed-thread-view="true"]`.
- [x] **Step 2:** Render the Vietnamese demo translation automatically inside each main message host, preserving the original Japanese message above it.
- [x] **Step 3:** Remove the per-message `Dịch` toolbar from the default UX while keeping the three-dot summary action available on the message host.
- [x] **Step 4:** Regenerate the standalone HTML with local CSS inlined and repackage the demo assets.
- [x] **Step 5:** Manually verify in the in-app browser that every main message has an inline translation and that thread replies do not receive one.
