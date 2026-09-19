const UI_ATTR = "data-tc-ui";
const cleanChatMessageText = globalThis.TranslateChatMessageText.cleanMessageText;
const getMessageRenderTarget = globalThis.TranslateChatMessageSurface.findMessageRenderTarget;
const isTranslatableMessageNode = globalThis.TranslateChatMessageSurface.isTranslatableMessageNode;
const keepSingleMessageSurface = globalThis.TranslateChatMessageSurface.keepSingleMessageSurface;
let settings = {
  enabled: true,
  targetLanguage: "vi",
  sourceLanguage: "auto",
  autoTranslate: true,
  showOriginal: true,
  autoSummary: false,
  baseUrl: "",
  apiKey: "",
  model: ""
};
let observer;
let activeSummary = null;
let lastMenuMessage = null;
let roomEnabled = false;
let currentRoom = { id: "", label: "", supported: false };
let lastUrl = location.href;

const style = document.createElement("style");
style.setAttribute(UI_ATTR, "");
style.textContent = [
  "[data-tc-translation]{margin-top:6px;padding:7px 9px;border-left:3px solid #2b8174;background:#e8f5f1;color:#173d37;border-radius:5px;font-size:.94em;line-height:1.45}",
  "[data-tc-surface]{display:block;flex:0 0 auto;align-self:stretch;width:100%;max-width:100%;min-width:0;height:auto;max-height:none;overflow:visible;box-sizing:border-box}",
  "[data-tc-translation]{display:block;height:auto;max-height:none;overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;box-sizing:border-box}",
  "[data-tc-translation] [data-tc-label]{display:block;color:#5c7772;font-size:11px;margin-bottom:3px}",
  "[data-tc-action],[data-tc-summary-menu]{border:1px solid #b9d9d2;background:#fff;color:#1c665d;border-radius:12px;padding:3px 8px;cursor:pointer;font-size:11px}",
  "[data-tc-action]:disabled{opacity:.55;cursor:wait}",
  "[data-tc-error]{margin-top:5px;color:#9a3d34;font-size:12px}",
  "[data-tc-summary-card]{position:fixed;z-index:2147483646;right:24px;top:80px;width:min(390px,calc(100vw - 48px));max-height:70vh;overflow:auto;padding:16px;background:#fffdf5;border:1px solid #e5d7a2;border-radius:12px;box-shadow:0 10px 35px #17232b33;color:#27352f;font-family:system-ui,sans-serif}",
  "[data-tc-summary-card] h3{margin:0 0 8px;font-size:16px}",
  "[data-tc-summary-card] p{white-space:pre-wrap;line-height:1.5;font-size:13px}",
  "[data-tc-summary-card] [data-tc-toolbar]{display:flex;gap:6px;align-items:center;margin-top:12px}",
  "[data-tc-summary-card] button{border:1px solid #d6c78f;background:#fff;border-radius:7px;padding:5px 8px;cursor:pointer}",
  "[data-tc-summary-card] [data-tc-primary]{background:#287d70;border-color:#287d70;color:#fff}",
  "[data-tc-stale]{display:block;margin:6px 0;color:#8a6b1f;font-size:12px}",
  "[data-tc-menu-item]{display:block;width:100%;border:0;background:transparent;padding:9px 12px;text-align:left;cursor:pointer;font:inherit}",
  "[data-tc-menu-item]:hover{background:#eef6f4}"
].join("");
document.documentElement.append(style);

function detectRoom() {
  const match = location.pathname.match(/\/(?:app\/chat|room)\/([^/]+)/i);
  const roomId = (match ? decodeURIComponent(match[1]) : "")
    || document.documentElement.dataset.tcRoomId
    || document.querySelector("[data-tc-room-id]")?.dataset.tcRoomId
    || "";
  const label = document.querySelector("[data-tc-room-label]")?.textContent.trim()
    || document.querySelector("[aria-label*='room' i]")?.getAttribute("aria-label")
    || document.title.replace(/\s*-\s*Chat\s*$/i, "").trim();
  return { id: roomId, label: label || roomId, supported: Boolean(roomId) };
}

function clearInjectedUi() {
  document.querySelectorAll("[" + UI_ATTR + "]").forEach((node) => node.remove());
  document.querySelectorAll("[data-tc-enhanced]").forEach((node) => node.removeAttribute("data-tc-enhanced"));
  activeSummary = null;
  lastMenuMessage = null;
}

function ensureStyle() {
  if (!style.isConnected) document.documentElement.append(style);
}

function send(message) {
  return chrome.runtime.sendMessage(message).then((response) => {
    if (!response || !response.ok) throw new Error(response?.error || "Request failed");
    return response;
  });
}

async function refreshRoomGate() {
  currentRoom = detectRoom();
  roomEnabled = Boolean(settings.enabled && currentRoom.supported && settings.roomAllowlist?.[currentRoom.id]);
  if (roomEnabled) ensureStyle();
  else clearInjectedUi();
  return roomEnabled;
}

function messageNodes() {
  const seen = new Set();
  return [...document.querySelectorAll("[data-message-id], [data-chat-message]")]
    .filter((node) => !node.closest("[" + UI_ATTR + "]") && isTranslatableMessageNode(node))
    .filter((node) => {
      const id = node.dataset.messageId || node.dataset.chatMessage || "";
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function messageHost(node) {
  if (node.hasAttribute("data-text")) return node;
  const author = node.dataset.author || node.querySelector("[data-author]")?.textContent.trim() || "";
  const time = node.dataset.time || node.querySelector("time")?.textContent.trim() || "";
  let current = node;
  for (let depth = 0; depth < 8 && current.parentElement; depth += 1) {
    const parent = current.parentElement;
    const bodySiblings = [...parent.children].map((child) => {
      if (child === current || child.contains(node)) return false;
      if (child.matches("button,[data-tc-ui],[data-menu],[data-menu-popup],[data-message-actions],time,[role='button']")) return false;
      return cleanChatMessageText(child.innerText || child.textContent || "", { author, time });
    }).filter(Boolean);
    const bodySibling = bodySiblings
      .filter((text) => !/^(?:(?:hôm qua|yesterday|hôm nay|today)\s+)?\d{1,2}:\d{2}$/iu.test(text))
      .sort((left, right) => right.length - left.length)[0];
    if (bodySibling) return parent;
    current = parent;
  }
  return node;
}

function removeNodeBranch(clone, host, node) {
  const path = [];
  let current = node;
  while (current && current !== host) {
    const parent = current.parentElement;
    if (!parent) return;
    path.unshift([...parent.children].indexOf(current));
    current = parent;
  }
  if (current !== host) return;
  let branch = clone;
  for (const index of path) {
    branch = branch.children[index];
    if (!branch) return;
  }
  branch.remove();
}

function messageNodeFor(element) {
  const direct = element.closest("[data-message-id], [data-chat-message]");
  if (direct) return direct;
  let current = element.parentElement;
  while (current && current !== document.body) {
    const nested = current.querySelector("[data-message-id], [data-chat-message]");
    if (nested) return nested;
    current = current.parentElement;
  }
  return null;
}

function existingMessageSurface(node, renderTarget) {
  const host = node.closest(".F0wyae") || node.closest('[jsname="Ne3sFf"]') || renderTarget;
  const surfaces = [...host.querySelectorAll("[data-tc-surface]")];
  surfaces.slice(1).forEach((surface) => surface.remove());
  const existing = surfaces[0] || null;
  if (existing && existing.parentElement !== renderTarget) renderTarget.append(existing);
  return existing;
}

function textOf(node) {
  const explicit = node.getAttribute("data-text");
  if (explicit) return explicit.trim();
  const host = messageHost(node);
  const clone = host.cloneNode(true);
  if (host !== node) removeNodeBranch(clone, host, node);
  clone.querySelectorAll("button,[data-tc-ui],[data-menu],[data-menu-popup],[data-message-actions],time,[role='button']").forEach((item) => item.remove());
  return cleanChatMessageText(clone.innerText || clone.textContent || "", {
    author: node.dataset.author || node.querySelector("[data-author]")?.textContent.trim() || "",
    time: node.dataset.time || node.querySelector("time")?.textContent.trim() || ""
  });
}

function dataOf(node) {
  const thread = node.dataset.threadId || node.dataset.thread || node.closest("[data-thread-id]")?.dataset.threadId || node.dataset.messageId;
  return {
    node,
    id: node.dataset.messageId || node.dataset.chatMessage || "",
    threadId: thread || "",
    author: node.dataset.author || node.querySelector("[data-author]")?.textContent.trim() || "Unknown",
    time: node.dataset.time || node.querySelector("time")?.textContent.trim() || "",
    text: textOf(node)
  };
}

function renderError(container, error) {
  container.replaceChildren();
  const errorNode = document.createElement("div");
  errorNode.setAttribute("data-tc-error", "");
  errorNode.textContent = error.message || "Không thể xử lý";
  container.append(errorNode);
}

async function translate(node, action, output) {
  const data = dataOf(node);
  action.disabled = true;
  action.textContent = "Đang dịch...";
  output.replaceChildren();
  try {
    const response = await send({
      type: "TRANSLATE",
      text: data.text,
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage
    });
    const label = document.createElement("span");
    label.setAttribute("data-tc-label", "");
    label.textContent = "AI · " + settings.targetLanguage + (response.result.cached ? " · cache" : "");
    output.append(label, document.createTextNode(response.result.text));
    output.hidden = false;
    action.textContent = "Dịch lại";
  } catch (error) {
    renderError(output, error);
    output.hidden = false;
    action.textContent = "Thử lại";
  } finally {
    action.disabled = false;
  }
}

function ensureMessage(node) {
  const renderTarget = getMessageRenderTarget(node);
  if (existingMessageSurface(node, renderTarget) || keepSingleMessageSurface(renderTarget)) {
    node.setAttribute("data-tc-enhanced", "true");
    return;
  }
  if (node.hasAttribute("data-tc-enhanced")) return;
  const data = dataOf(node);
  if (!data.text) return;
  node.setAttribute("data-tc-enhanced", "true");
  const action = document.createElement("button");
  action.setAttribute(UI_ATTR, "");
  action.setAttribute("data-tc-action", "");
  action.textContent = "Dịch";
  const output = document.createElement("div");
  output.setAttribute(UI_ATTR, "");
  output.setAttribute("data-tc-translation", "");
  output.hidden = true;
  action.addEventListener("click", () => translate(node, action, output));
  const surface = document.createElement("div");
  surface.setAttribute(UI_ATTR, "");
  surface.setAttribute("data-tc-surface", "");
  surface.append(action, output);
  renderTarget.append(surface);
  if (settings.enabled && roomEnabled && settings.autoTranslate && settings.baseUrl && settings.apiKey && settings.model) {
    translate(node, action, output);
  }
}

function collectThread(threadId) {
  return messageNodes().map(dataOf).filter((item) => item.threadId === threadId);
}

function fingerprint(messages) {
  return JSON.stringify(messages.map((item) => [item.id, item.author, item.time, item.text]));
}

function summaryCard(threadId, messages) {
  activeSummary = { threadId, fingerprint: fingerprint(messages), count: 0, card: null, summary: "" };
  const card = document.createElement("section");
  card.setAttribute(UI_ATTR, "");
  card.setAttribute("data-tc-summary-card", "");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "AI thread summary");
  card.innerHTML = "<h3>AI summary · " + (settings.model || "model") + "</h3><div data-tc-summary-body>Đang tóm tắt...</div><div data-tc-toolbar><button data-tc-primary>Cập nhật</button><button data-tc-copy>Copy</button><button data-tc-close>Đóng</button></div>";
  document.body.append(card);
  activeSummary.card = card;
  card.querySelector("[data-tc-close]").addEventListener("click", () => { card.remove(); activeSummary = null; });
  card.querySelector("[data-tc-copy]").addEventListener("click", async () => {
    await navigator.clipboard.writeText(activeSummary.summary || card.querySelector("[data-tc-summary-body]").textContent);
  });
  card.querySelector("[data-tc-primary]").addEventListener("click", () => updateSummary(true));
  updateSummary(false);
}

async function updateSummary(force) {
  if (!activeSummary) return;
  const messages = collectThread(activeSummary.threadId);
  const nextFingerprint = fingerprint(messages);
  const body = activeSummary.card.querySelector("[data-tc-summary-body]");
  const stale = activeSummary.card.querySelector("[data-tc-stale]");
  const oldMessages = JSON.parse(activeSummary.fingerprint);
  if (!force && activeSummary.fingerprint !== nextFingerprint) {
    activeSummary.count = Math.max(1, messages.length - oldMessages.length);
  }
  const appendOnly = oldMessages.every((old, index) => JSON.stringify(old) === JSON.stringify([messages[index]?.id, messages[index]?.author, messages[index]?.time, messages[index]?.text]));
  const requestMessages = !activeSummary.summary || !appendOnly ? messages : messages.slice(oldMessages.length);
  if (activeSummary.fingerprint !== nextFingerprint && !stale) {
    const notice = document.createElement("span");
    notice.setAttribute("data-tc-stale", "");
    notice.textContent = "Có " + activeSummary.count + " message mới";
    activeSummary.card.insertBefore(notice, body);
  }
  if (!force && activeSummary.summary && activeSummary.fingerprint !== nextFingerprint) return;
  body.textContent = "Đang tóm tắt...";
  try {
    const response = await send({ type: "SUMMARY", threadId: activeSummary.threadId, messages: requestMessages, previousSummary: activeSummary.summary });
    activeSummary.summary = response.result.text;
    activeSummary.fingerprint = nextFingerprint;
    const oldStale = activeSummary.card.querySelector("[data-tc-stale]");
    if (oldStale) oldStale.remove();
    body.textContent = response.result.text;
  } catch (error) {
    renderError(body, error);
  }
}

function injectSummaryMenu(menu) {
  if (!lastMenuMessage || menu.querySelector("[data-tc-menu-item]") || !lastMenuMessage.threadId) return;
  const item = document.createElement("button");
  item.setAttribute(UI_ATTR, "");
  item.setAttribute("data-tc-menu-item", "");
  item.textContent = "Tóm tắt thread bằng AI";
  item.addEventListener("click", () => {
    menu.hidden = true;
    summaryCard(lastMenuMessage.threadId, collectThread(lastMenuMessage.threadId));
  });
  menu.append(item);
}

function scan() {
  if (!settings.enabled || !roomEnabled) return;
  ensureStyle();
  messageNodes().forEach(ensureMessage);
  document.querySelectorAll("[data-menu-popup],[role='menu']").forEach(injectSummaryMenu);
}

document.addEventListener("click", (event) => {
  if (!roomEnabled) return;
  const menuButton = event.target.closest("[data-menu]");
  if (menuButton) {
    const message = messageNodeFor(menuButton);
    lastMenuMessage = message ? dataOf(message) : null;
    queueMicrotask(scan);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "GET_ROOM_STATUS") {
      await refreshRoomGate();
      sendResponse({ ok: true, roomId: currentRoom.id, label: currentRoom.label, supported: currentRoom.supported, enabled: roomEnabled });
      return;
    }
    if (message.type === "SET_ROOM_ENABLED") {
      await refreshRoomGate();
      if (!currentRoom.supported || message.roomId !== currentRoom.id) {
        sendResponse({ ok: false, error: "Room không được nhận diện" });
        return;
      }
      const response = await send({
        type: "SET_ROOM_ENABLED",
        roomId: currentRoom.id,
        label: currentRoom.label,
        enabled: Boolean(message.enabled)
      });
      settings = response.settings;
      await refreshRoomGate();
      scan();
      sendResponse({ ok: true, settings, enabled: roomEnabled });
    }
  })().catch((error) => sendResponse({ ok: false, error: error.message || "Room update failed" }));
  return true;
});

async function boot() {
  try {
    const response = await send({ type: "GET_SETTINGS" });
    settings = response.settings;
  } catch {}
  await refreshRoomGate();
  clearInjectedUi();
  scan();
  observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      refreshRoomGate();
    }
    scan();
    if (activeSummary) {
      const current = collectThread(activeSummary.threadId);
      if (fingerprint(current) !== activeSummary.fingerprint) updateSummary(false);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings) return;
    settings = changes.settings.newValue || settings;
    refreshRoomGate();
    scan();
  });
}

boot();
