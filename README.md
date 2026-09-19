# TranslateChat AI

> Chrome MV3 extension that translates Google Chat messages inline and creates private AI summaries for threads.

## What It Does

- Translates the main message body into a selected language, with Vietnamese as the default.
- Automatically translates newly rendered messages when `Tự dịch message mới` is enabled.
- Works in the main room and in an opened child thread.
- Adds `Tóm tắt thread bằng AI` to the message three-dot menu.
- Uses an OpenAI-compatible provider such as a local 9router endpoint.
- Caches successful translations and summaries locally to avoid repeat requests.
- Masks password, bearer-token, and API-key-like text before sending it to the provider.

## Install Unpacked

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Open Google Chat, then reload the extension from `chrome://extensions` after source changes.
5. Hard-refresh the Google Chat tab.

The extension only matches `chat.google.com` and the local fixture URL used by tests.

## Configure Provider

1. Click the extension icon and choose **Mở Settings**, or open the extension's Options page.
2. Set **Base URL** to your OpenAI-compatible endpoint, for example `http://127.0.0.1:<port>/v1`.
3. Enter the provider API key. It is stored in `chrome.storage.local`, not Chrome Sync.
4. Choose a model. Model names containing `luna` are listed first; `gpt-5.6-luna` or the exact model ID from your provider can be selected.
5. Set the target language, source detection, timeout, cache TTL, and credential masking.
6. Click **Lưu Settings**.

The extension does not call Google Translate. Translation and summary both use the configured AI provider.

## Enable Specific Rooms

Translation is off for rooms until you explicitly enable them.

1. Open the target room in Google Chat.
2. Click the extension icon.
3. Turn on **Dịch room này**.
4. Leave it off for rooms that should not be processed.

The allowlist is stored locally with the extension settings. Turning the global **Dịch tự động** switch off stops new translation work while keeping settings intact.

## Translate Messages

- With auto-translation enabled, a `Dịch` action and translation surface appear below supported message text.
- The original message stays visible. Long translations wrap inside the message bubble.
- Open a child thread: replies in the detailed thread panel are observed and translated automatically.
- Click `Dịch lại` to explicitly retry a failed or updated translation.
- Provider errors show a safe message inside the extension UI; the original Chat message is not replaced.

![Inline translation](docs/screenshots/02-inline-translation.png)

![Child thread translation](docs/screenshots/03-child-thread.png)

## Summarize a Thread

1. Open the message's three-dot menu.
2. Click **Tóm tắt thread bằng AI**.
3. Read the private summary card shown by the extension.
4. When new messages arrive, the card shows a stale notice.
5. Click **Cập nhật** to summarize the changed thread. The summary is never posted into Google Chat.

![Private summary card](docs/screenshots/04-summary-card.png)

## Cache and Privacy

- Translation and summary caches use separate local namespaces.
- A successful result can be reused until the configured TTL expires.
- Failed provider responses are not cached.
- **Xóa cache dịch** and **Xóa cache summary** clear only their respective cache.
- Provider output is rendered as text, so HTML-like output is not executed.
- Do not place production API keys, private room exports, or real message screenshots in the repository.

## Troubleshooting

| Symptom | Check |
|---|---|
| No translation appears | Confirm the room toggle is on, global auto-translation is on, and the provider model is configured. |
| Authentication error | Re-enter the provider API key in Settings. |
| Rate-limit or server error | Click `Dịch lại` or `Cập nhật` after the provider is available; there is no hidden retry loop. |
| Timeout | Increase the Settings timeout or check the local provider process. |
| Child thread is not translated | Reload the extension, hard-refresh Google Chat, enable the current room, then reopen the child thread. |
| Old translation remains after editing | Click `Dịch lại`; the new source text uses a new cache key. |

![Provider error state](docs/screenshots/05-provider-error.png)

## Development and Tests

Install dependencies once:

```bash
npm install
```

Run unit tests:

```bash
npm run test:unit
```

Run extension E2E tests with the deterministic local Chat/provider fixtures:

```bash
npm run test:e2e
```

Run both suites:

```bash
npm test
```

Capture the README screenshots:

```bash
node scripts/capture-readme-screenshots.mjs
```

The automated tests never use production Google Chat, production 9router, real API keys, or live room content.
