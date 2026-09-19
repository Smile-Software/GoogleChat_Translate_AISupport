# Room Translation Allowlist Design

- Date: 2026-09-19
- Project: TranslateChat
- Scope: Chrome extension and static UX demo

## Goal

Allow TranslateChat to operate only in rooms explicitly enabled by the user. A
room that has not been enabled must not receive translation UI, summary UI, or
provider requests.

## Decisions

- Use an allowlist, not a global-on/denylist model.
- All rooms are disabled by default. The existing global `enabled` setting
  remains a master switch.
- Identify a room from Google Chat URL forms (`/app/chat/<roomId>` and
  `/room/<roomId>/...`) with a DOM fallback for local fixtures and dumped pages.
- Store room entries in `chrome.storage.local`; never use sync storage.
- The room switch gates both translation and AI summary features so content
  from an unapproved room is never sent to the provider.
- The popup is the primary control. Settings can show and remove saved rooms.

## UX

### Popup

The popup keeps the global extension switch and adds a room-specific switch:

- `Dịch room này`: enabled when the active Google Chat room is in the allowlist.
- Show the current room label and a short state: `Đang bật` or `Chưa bật`.
- Disable the room switch when the active tab is not a supported Google Chat
  page or the content script cannot identify a room.
- Changing the switch persists immediately and sends the new room state to the
  content script.

### Settings

Add an `Rooms được bật` section containing the saved room labels and IDs. Each
entry has a remove action. Removing a room immediately disables it in all open
tabs after the storage change event propagates.

### In-page behavior

- Enabled room: existing inline translation, three-dot summary action, cache,
  and new-message observer continue to work.
- Disabled room: remove all TranslateChat-injected nodes and stop scans,
  provider requests, and summary menu injection.
- If the user navigates between rooms inside the SPA, recompute the room ID and
  refresh the gate without requiring a full page reload.

### Demo behavior

The dump demo gets a visible `Dịch room này` switch in its local overlay. The
captured room starts enabled so the existing translation preview remains
reviewable. Turning it off removes all inline translations and summary actions;
turning it on restores them. The demo uses an in-memory allowlist and does not
call a provider.

## Data model

Extend normalized settings with:

```js
roomAllowlist: {
  "AAQA47qiLo4": {
    label: "Chemmat 改修・運用連携",
    enabledAt: 1789790000000
  }
}
```

`normalizeSettings` must discard malformed room IDs and normalize labels. A
missing allowlist becomes `{}`, so existing installations require explicit
room opt-in after the feature is installed.

The content script exposes two message contracts to the popup:

```js
{ type: "GET_ROOM_STATUS" }
// -> { ok: true, roomId, label, enabled, supported: true }

{ type: "SET_ROOM_ENABLED", roomId, label, enabled: true }
// -> { ok: true, settings, enabled: true }
```

The content script remains responsible for room detection and DOM cleanup;
the service worker remains the owner of persisted settings.

## Data flow

1. Content script detects the current room ID and label during boot and after
   URL/DOM changes.
2. Content script requests normalized settings and computes `roomEnabled` from
   the global switch plus the allowlist entry.
3. Popup requests room status from the active tab and renders the switch.
4. Popup sends a room toggle request to the content script.
5. Content script sends a settings update to the service worker.
6. The service worker writes `chrome.storage.local` and returns normalized
   settings.
7. The content script refreshes or clears its injected UI. Other tabs react to
   `chrome.storage.onChanged`.

## Error handling and safety

- Unknown or malformed room IDs are treated as unsupported and remain off.
- If storage fails, the current room stays off and no provider call is made.
- If the active tab is not Google Chat, popup controls show an unavailable
  state instead of changing the last room.
- Room labels are display-only metadata; room IDs are the stable keys.
- Existing cached translations are not deleted when a room is disabled, but no
  cached value is rendered or requested until the room is enabled again.

## Verification

Manual verification will cover:

1. Popup on an unsupported tab shows the room switch disabled.
2. Enabling the current room renders translation and summary UI.
3. Disabling the room removes injected UI and prevents new provider calls.
4. Switching to an unlisted room keeps the page untouched.
5. Reloading the extension preserves the allowlist in local storage.
6. A new message is translated only while its room is enabled.
7. Settings can remove a saved room and all open tabs turn off accordingly.

The static demo will be checked manually in the browser; no provider or
production Google Chat content is used by the demo.
