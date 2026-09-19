import { setRoomEnabled } from "../settings/rooms.js";

const $ = (id) => document.getElementById(id);
let settings = {};

function send(message) {
  return chrome.runtime.sendMessage(message);
}

function readForm() {
  return {
    ...settings,
    baseUrl: $("baseUrl").value,
    apiKey: $("apiKey").value,
    model: $("model").value,
    requestTimeoutMs: Number($("timeout").value),
    targetLanguage: $("target").value,
    sourceLanguage: $("source").value,
    autoTranslate: $("autoTranslate").checked,
    showOriginal: $("showOriginal").checked,
    summaryLanguage: $("summaryLanguage").value,
    summaryLength: $("summaryLength").value,
    autoSummary: $("autoSummary").checked,
    maskCredentials: $("maskCredentials").checked,
    cacheTtlDays: Number($("cacheTtlDays").value)
  };
}

function fill(value) {
  settings = value;
  $("baseUrl").value = value.baseUrl;
  $("apiKey").value = value.apiKey;
  $("model").value = value.model;
  $("timeout").value = value.requestTimeoutMs;
  $("target").value = value.targetLanguage;
  $("source").value = value.sourceLanguage;
  $("autoTranslate").checked = value.autoTranslate;
  $("showOriginal").checked = value.showOriginal;
  $("summaryLanguage").value = value.summaryLanguage;
  $("summaryLength").value = value.summaryLength;
  $("autoSummary").checked = value.autoSummary;
  $("maskCredentials").checked = value.maskCredentials;
  $("cacheTtlDays").value = value.cacheTtlDays;
  renderRooms(value);
}

function renderRooms(value) {
  const list = $("room-list");
  list.replaceChildren();
  const entries = Object.entries(value.roomAllowlist || {});
  if (!entries.length) {
    list.textContent = "Chưa bật room nào.";
    return;
  }
  entries.forEach(([roomId, room]) => {
    const row = document.createElement("div");
    row.className = "room-row";
    const label = document.createElement("span");
    label.textContent = (room.label || roomId) + " · " + roomId;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Tắt";
    remove.addEventListener("click", async () => {
      settings = setRoomEnabled(settings, roomId, room.label, false);
      const response = await send({ type: "SAVE_SETTINGS", settings });
      if (response.ok) {
        fill(response.settings);
        $("status").textContent = "Đã tắt room";
      }
    });
    row.append(label, remove);
    list.append(row);
  });
}

async function loadModels() {
  $("provider-status").textContent = "Đang tải model...";
  const response = await send({ type: "LIST_MODELS" });
  if (!response.ok) throw new Error(response.error);
  $("models").replaceChildren();
  response.models.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    $("models").append(option);
  });
  $("provider-status").textContent = response.models.length + " model";
}

$("save").addEventListener("click", async () => {
  const next = readForm();
  const response = await send({ type: "SAVE_SETTINGS", settings: next });
  if (!response.ok) {
    $("status").textContent = response.error;
    $("status").className = "error";
    return;
  }
  fill(response.settings);
  $("status").textContent = "Đã lưu";
  $("status").className = "";
});
$("load-models").addEventListener("click", () => loadModels().catch((error) => { $("provider-status").textContent = error.message; }));
$("test-provider").addEventListener("click", async () => {
  try { await loadModels(); $("provider-status").textContent = "Provider sẵn sàng"; }
  catch (error) { $("provider-status").textContent = error.message; }
});
$("clearTranslation").addEventListener("click", async () => { await send({ type: "CLEAR_CACHE", kind: "translation" }); $("status").textContent = "Đã xóa cache dịch"; });
$("clearSummary").addEventListener("click", async () => { await send({ type: "CLEAR_CACHE", kind: "summary" }); $("status").textContent = "Đã xóa cache summary"; });

send({ type: "GET_SETTINGS" }).then((response) => fill(response.settings)).catch((error) => { $("status").textContent = error.message; });
