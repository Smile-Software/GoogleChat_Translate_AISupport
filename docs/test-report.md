# TranslateChat AI Test Report

- Date: 2026-09-19
- Environment: macOS arm64, Node v25.9.0, npm 11.12.1, Playwright 1.63.0, Chrome for Testing 153.0.8010.12
- Provider: local OpenAI-compatible 9router at `http://127.0.0.1:20128/v1`
- Chat: local deterministic Google Chat fixture plus manual live DOM verification

## Results

- Unit: 15 passed, 0 failed
- E2E: 7 passed, 0 failed
- Full command: npm test
- Extension load: unpacked MV3 loaded into Google Chrome, extension ID nbhoeegpgfeieommmnjnmchiegfijkbe

## Verified flows

- Inline Japanese to Vietnamese translation
- Translation cache reuse after reload
- Auto-translation for new messages
- Three-dot menu action Tóm tắt thread bằng AI
- Private summary card with no Google Chat message mutation
- Stale summary badge after new reply
- Incremental summary update with new reply text
- Luna-first model ordering
- Credential masking before provider request
- Real Google Chat DOM inspection and message-body extraction after the live `[data-message-id]` marker

## Live verification

- Chrome profile: `Đặng (Smile)` / Profile 1
- Extension ID: `nbhoeegpgfeieommmnjnmchiegfijkbe`
- The live room rendered TranslateChat controls on message shells without mutating Google Chat message text.
- The live DOM confirmed that Google Chat places `[data-message-id]` in the author/header branch; message text is a sibling body branch several ancestors higher.
- Provider smoke test translated Japanese to Vietnamese successfully through `gpt-5.6-luna`.

## Known limitation

The CUA browser connector could not attach to Chrome because Codex auth was unavailable. Manual Chrome inspection was still performed through the native app surface; no credentials or message contents are recorded in this report.

## Cleanup

- Local mock provider stopped.
- Local fixture server stopped.
- Test Base URL and API key removed from extension Settings.
