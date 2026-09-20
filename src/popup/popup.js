const $ = (id) => document.getElementById(id);
let settings;
let activeTabId = null;
let roomStatus = null;

function send(message) {
  return chrome.runtime.sendMessage(message);
}

async function load() {
  const response = await send({ type: "GET_SETTINGS" });
  settings = response.settings;
  $("enabled").checked = settings.enabled;
  $("target").value = settings.targetLanguage;
  $("outgoing-target").value = settings.outgoingTargetLanguage;
  const models = await send({ type: "LIST_MODELS" }).catch(() => ({ ok: false, models: [] }));
  $("model").replaceChildren();
  const ids = models.ok ? models.models : [];
  if (!ids.includes(settings.model) && settings.model) ids.unshift(settings.model);
  (ids.length ? ids : [""]).forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id || "Chưa cấu hình";
    $("model").append(option);
  });
  $("model").value = settings.model;
  $("status").textContent = settings.baseUrl && settings.apiKey && settings.model ? "Provider sẵn sàng" : "Mở Settings để cấu hình";
  await loadRoomStatus();
}

async function loadRoomStatus() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tabs[0]?.id || null;
  if (!activeTabId) return renderRoomStatus({ supported: false, label: "Không có tab đang mở" });
  try {
    roomStatus = await chrome.tabs.sendMessage(activeTabId, { type: "GET_ROOM_STATUS" });
    renderRoomStatus(roomStatus);
  } catch {
    roomStatus = { supported: false, label: "Không phải trang Google Chat hoặc extension chưa sẵn sàng" };
    renderRoomStatus(roomStatus);
  }
}

function renderRoomStatus(value) {
  $("room-label").textContent = value.label || "Room chưa xác định";
  $("room-status").textContent = !value.supported ? "Không hỗ trợ room này" : (value.enabled ? "Đang bật" : "Chưa bật");
  $("room-enabled").disabled = !value.supported;
  $("room-enabled").checked = Boolean(value.enabled);
}

async function save(patch) {
  settings = { ...settings, ...patch };
  await send({ type: "SAVE_SETTINGS", settings });
}

$("enabled").addEventListener("change", () => save({ enabled: $("enabled").checked }));
$("room-enabled").addEventListener("change", async () => {
  if (!activeTabId || !roomStatus?.supported) return;
  const response = await chrome.tabs.sendMessage(activeTabId, {
    type: "SET_ROOM_ENABLED",
    roomId: roomStatus.roomId,
    label: roomStatus.label,
    enabled: $("room-enabled").checked
  });
  if (!response?.ok) {
    $("room-status").textContent = response?.error || "Không thể cập nhật room";
    $("room-enabled").checked = !$("room-enabled").checked;
    return;
  }
  roomStatus = { ...roomStatus, enabled: response.enabled };
  renderRoomStatus(roomStatus);
});
$("target").addEventListener("change", () => save({ targetLanguage: $("target").value, incomingTargetLanguage: $("target").value }));
$("outgoing-target").addEventListener("change", () => save({ outgoingTargetLanguage: $("outgoing-target").value }));
$("model").addEventListener("change", () => save({ model: $("model").value }));
$("clear-translation").addEventListener("click", async () => {
  await send({ type: "CLEAR_CACHE", kind: "translation" });
  $("status").textContent = "Đã xóa cache dịch";
});
$("open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
load().catch((error) => { $("status").textContent = error.message; });
