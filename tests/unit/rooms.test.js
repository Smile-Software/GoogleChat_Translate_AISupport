import test from "node:test";
import assert from "node:assert/strict";
import { extractRoomId, isRoomEnabled, normalizeRoomAllowlist, setRoomEnabled } from "../../src/settings/rooms.js";

test("extracts room IDs from Google Chat app and room URLs", () => {
  assert.equal(extractRoomId("https://chat.google.com/app/chat/AAQA47qiLo4"), "AAQA47qiLo4");
  assert.equal(extractRoomId("https://chat.google.com/room/AAQA47qiLo4/thread/123"), "AAQA47qiLo4");
  assert.equal(extractRoomId("https://example.com/inbox"), "");
});

test("normalizes room allowlist and drops malformed entries", () => {
  const value = normalizeRoomAllowlist({
    " AAQA47qiLo4 ": { label: "  Chemmat room  ", enabledAt: 123 },
    "bad room": { label: "Ignored" },
    empty: null
  });

  assert.deepEqual(value, {
    AAQA47qiLo4: { label: "Chemmat room", enabledAt: 123 }
  });
});

test("rooms are disabled until explicitly enabled", () => {
  assert.equal(isRoomEnabled({ enabled: true, roomAllowlist: {} }, "AAQA47qiLo4"), false);
  assert.equal(isRoomEnabled({ enabled: true, roomAllowlist: { AAQA47qiLo4: { label: "Room" } } }, "AAQA47qiLo4"), true);
  assert.equal(isRoomEnabled({ enabled: false, roomAllowlist: { AAQA47qiLo4: { label: "Room" } } }, "AAQA47qiLo4"), false);
});

test("setRoomEnabled adds and removes a room without changing other settings", () => {
  const initial = { enabled: true, model: "luna-fast", roomAllowlist: {} };
  const enabled = setRoomEnabled(initial, "AAQA47qiLo4", "Chemmat room", true);
  assert.equal(enabled.model, "luna-fast");
  assert.equal(enabled.roomAllowlist.AAQA47qiLo4.label, "Chemmat room");
  const disabled = setRoomEnabled(enabled, "AAQA47qiLo4", "Chemmat room", false);
  assert.deepEqual(disabled.roomAllowlist, {});
});
