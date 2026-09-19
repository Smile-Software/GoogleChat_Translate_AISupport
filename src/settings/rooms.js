const ROOM_ID_PATTERN = /^[A-Za-z0-9._-]{3,160}$/;

export function extractRoomId(value) {
  let pathname = String(value || "");
  try { pathname = new URL(pathname, "https://chat.google.com").pathname; } catch {}
  const match = pathname.match(/\/(?:app\/chat|room)\/([^/]+)/i);
  if (!match) return "";
  const roomId = decodeURIComponent(match[1]);
  return ROOM_ID_PATTERN.test(roomId) ? roomId : "";
}

function normalizeRoomId(value) {
  const roomId = String(value || "").trim();
  return ROOM_ID_PATTERN.test(roomId) ? roomId : "";
}

function normalizeRoomEntry(value, roomId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const label = String(value.label || roomId).trim().slice(0, 160) || roomId;
  const enabledAt = Number(value.enabledAt);
  return {
    label,
    enabledAt: Number.isFinite(enabledAt) ? enabledAt : 0
  };
}

export function normalizeRoomAllowlist(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.entries(input).reduce((out, [rawRoomId, rawEntry]) => {
    const roomId = normalizeRoomId(rawRoomId);
    const entry = roomId ? normalizeRoomEntry(rawEntry, roomId) : null;
    if (entry) out[roomId] = entry;
    return out;
  }, {});
}

export function isRoomEnabled(settings, roomId) {
  const normalizedId = normalizeRoomId(roomId);
  return Boolean(settings?.enabled && normalizedId && normalizeRoomAllowlist(settings.roomAllowlist)[normalizedId]);
}

export function setRoomEnabled(settings, roomId, label, enabled) {
  const normalizedId = normalizeRoomId(roomId);
  const roomAllowlist = normalizeRoomAllowlist(settings?.roomAllowlist);
  if (!normalizedId) return { ...settings, roomAllowlist };
  if (enabled) {
    roomAllowlist[normalizedId] = {
      label: String(label || normalizedId).trim().slice(0, 160) || normalizedId,
      enabledAt: Date.now()
    };
  } else {
    delete roomAllowlist[normalizedId];
  }
  return { ...settings, roomAllowlist };
}
