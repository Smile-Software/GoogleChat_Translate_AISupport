const UI_ATTR = "data-tc-ui";
const cleanChatMessageText = globalThis.TranslateChatMessageText.cleanMessageText;
const getMessageRenderTarget = globalThis.TranslateChatMessageSurface.findMessageRenderTarget;
const isTranslatableMessageNode = globalThis.TranslateChatMessageSurface.isTranslatableMessageNode;
const keepSingleMessageSurface = globalThis.TranslateChatMessageSurface.keepSingleMessageSurface;
const { runUiOperation, toUserError } = globalThis.TranslateChatOperationState || {};
let settings = {
  enabled: true,
  targetLanguage: "vi",
  incomingTargetLanguage: "vi",
  outgoingTargetLanguage: "ja",
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
const translationOperations = new WeakMap();
const composeStates = new WeakMap();
const MESSAGE_BODY_SELECTOR = ".DTp27d,[jsname='bgckF'],[data-message-body],.message-body";
const SEND_LABELS = new Set(["gửi", "gửi tin nhắn", "send", "send message"]);

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
  "[data-tc-summary-error]{margin-top:5px;color:#9a3d34;font-size:12px}",
  "[data-tc-summary-card]{position:fixed;z-index:2147483646;right:24px;top:80px;width:min(390px,calc(100vw - 48px));max-height:70vh;overflow:auto;padding:16px;background:#fffdf5;border:1px solid #e5d7a2;border-radius:12px;box-shadow:0 10px 35px #17232b33;color:#27352f;font-family:system-ui,sans-serif}",
  "[data-tc-summary-card] h3{margin:0 0 8px;font-size:16px}",
  "[data-tc-summary-card] p{white-space:pre-wrap;line-height:1.5;font-size:13px}",
  "[data-tc-summary-card] [data-tc-toolbar]{display:flex;gap:6px;align-items:center;margin-top:12px}",
  "[data-tc-summary-card] button{border:1px solid #d6c78f;background:#fff;border-radius:7px;padding:5px 8px;cursor:pointer}",
  "[data-tc-summary-card] [data-tc-primary]{background:#287d70;border-color:#287d70;color:#fff}",
  "[data-tc-compose-mount]{all:initial!important;box-sizing:border-box!important;display:inline-flex!important;flex:0 0 68px!important;width:68px!important;min-width:68px!important;max-width:68px!important;inline-size:68px!important;min-inline-size:68px!important;max-inline-size:68px!important;height:auto!important;min-height:40px!important;block-size:auto!important;min-block-size:40px!important;align-self:stretch!important;align-items:center!important;justify-content:center!important;position:relative!important;z-index:2!important;pointer-events:auto!important;overflow:hidden!important;background:#eaf0ff!important;border-radius:8px!important;margin:0 -4px!important}",
  "[data-tc-compose-button]{all:unset!important;box-sizing:border-box!important;width:34px!important;height:34px!important;margin:0!important;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;color:#5f6368!important;cursor:pointer!important;display:inline-grid!important;place-items:center!important;vertical-align:middle!important;pointer-events:auto!important;user-select:none!important}",
  "[data-tc-compose-button]:hover,[data-tc-compose-button][aria-expanded='true']{background:#e8f0fe;color:#174ea6}",
  "[data-tc-compose-mount]:hover{background:#e0e9ff!important}",
  "[data-tc-compose-button] svg{width:20px;height:20px;fill:currentColor}",
  "[data-tc-compose-panel]{position:fixed;z-index:2147483647;width:min(390px,calc(100vw - 24px));padding:14px;border:1px solid #d5dce8;border-radius:14px;background:#fff;box-shadow:0 14px 40px #17232b35;color:#202124;font-family:system-ui,sans-serif}",
  "[data-tc-compose-panel] header,[data-tc-compose-panel] footer{display:flex;align-items:center;gap:8px}",
  "[data-tc-compose-panel] header{justify-content:space-between;margin-bottom:12px}",
  "[data-tc-compose-panel] header strong{font-size:15px}",
  "[data-tc-compose-panel] [data-tc-compose-close]{border:0;background:transparent;color:#5f6368;font-size:20px;cursor:pointer;line-height:1}",
  "[data-tc-compose-panel] label{display:block;margin:8px 0 4px;color:#5f6368;font-size:11px;font-weight:600}",
  "[data-tc-compose-panel] select{width:100%;padding:7px;border:1px solid #c7cdd8;border-radius:7px;background:#fff;color:#202124}",
  "[data-tc-compose-panel] [data-tc-compose-block]{margin-top:10px;padding:9px 10px;border-radius:9px;background:#f8fafd;border:1px solid #e4e8f0}",
  "[data-tc-compose-panel] [data-tc-compose-context]{margin:9px 0 0;color:#5f6368;font-size:11px}",
  "[data-tc-compose-panel] [data-tc-compose-block] span{display:block;margin-bottom:4px;color:#6b7280;font-size:11px;font-weight:600}",
  "[data-tc-compose-panel] p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45;font-size:13px;max-height:110px;overflow:auto}",
  "[data-tc-compose-panel] [data-tc-compose-preview]{min-height:42px;color:#174ea6}",
  "[data-tc-compose-panel] [data-tc-compose-error]{color:#b3261e;font-size:12px}",
  "[data-tc-compose-panel] footer{justify-content:flex-end;margin-top:13px}",
  "[data-tc-compose-panel] footer button{padding:7px 10px;border:1px solid #c7cdd8;border-radius:8px;background:#fff;color:#3c4043;cursor:pointer}",
  "[data-tc-compose-panel] footer [data-tc-compose-insert]{border-color:#1a73e8;color:#1a73e8}",
  "[data-tc-compose-panel] footer [data-tc-compose-send]{border-color:#1a73e8;background:#1a73e8;color:#fff}",
  "[data-tc-compose-panel] button:disabled{opacity:.5;cursor:wait}",
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
  const runtime = globalThis.chrome?.runtime;
  if (typeof runtime?.sendMessage !== "function") {
    return Promise.reject(new Error("Extension context unavailable; reload the extension and Chat tab."));
  }
  return runtime.sendMessage(message).then((response) => {
    if (!response || !response.ok) {
      const error = new Error(response?.error || "Request failed");
      error.code = response?.code || "REQUEST_FAILED";
      error.status = response?.status || 0;
      error.retryable = Boolean(response?.retryable);
      error.userMessage = response?.error || "Request failed";
      throw error;
    }
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
  const ownBody = node.matches(MESSAGE_BODY_SELECTOR) ? node : node.querySelector(MESSAGE_BODY_SELECTOR);
  if (ownBody) return ownBody;
  let current = node;
  for (let depth = 0; depth < 8 && current.parentElement; depth += 1) {
    const parent = current.parentElement;
    const body = parent.querySelector(MESSAGE_BODY_SELECTOR);
    if (body && !body.contains(node)) return body;
    if (parent.matches("article,[data-message-container]")) break;
    current = parent;
  }
  return null;
}

function messageMetadata(node) {
  const named = node.closest("[data-name]");
  const timestamp = node.closest("[data-message-id]")?.querySelector("[data-absolute-timestamp],time")
    || node.querySelector("[data-absolute-timestamp],time")
    || node.closest("[data-name]")?.parentElement?.querySelector("[data-absolute-timestamp],time");
  return {
    author: node.dataset.author || node.dataset.name || named?.dataset.name || node.querySelector("[data-author]")?.textContent.trim() || "",
    time: node.dataset.time || timestamp?.textContent.trim() || ""
  };
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
  if (!host) return "";
  const clone = host.cloneNode(true);
  clone.querySelectorAll('[data-is-same-group-quote="true"], .Nld3je').forEach((item) => {
    const quoteWrapper = item.closest(".wVNE5");
    (quoteWrapper || item).remove();
  });
  clone.querySelectorAll("button,[data-tc-ui],[data-menu],[data-menu-popup],[data-message-actions],time,[role='button']").forEach((item) => item.remove());
  return cleanChatMessageText(clone.innerText || clone.textContent || "", messageMetadata(node));
}

function dataOf(node) {
  const thread = node.dataset.threadId || node.dataset.thread || node.closest("[data-thread-id]")?.dataset.threadId || node.dataset.messageId;
  const metadata = messageMetadata(node);
  return {
    node,
    id: node.dataset.messageId || node.dataset.chatMessage || "",
    threadId: thread || "",
    author: metadata.author || "Unknown",
    time: metadata.time,
    text: textOf(node)
  };
}

function renderError(container, error) {
  container.replaceChildren();
  const errorNode = document.createElement("div");
  errorNode.setAttribute("data-tc-error", "");
  errorNode.textContent = toUserError(error).message;
  container.append(errorNode);
}

async function translate(node, action, output) {
  const data = dataOf(node);
  const threadMessages = collectThread(data.threadId);
  const operationId = Symbol("translation");
  translationOperations.set(node, operationId);
  const isCurrent = () => translationOperations.get(node) === operationId && node.isConnected && output.isConnected;
  const result = await runUiOperation({
    request: () => send({
      type: "TRANSLATE",
      text: data.text,
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.incomingTargetLanguage || settings.targetLanguage,
      threadMessages
    }),
    onLoading: () => {
      action.disabled = true;
      action.textContent = "Đang dịch...";
      output.replaceChildren();
    },
    onSuccess: (response) => {
      if (!response.result?.text) throw new Error("Translation response missing content");
      const label = document.createElement("span");
      label.setAttribute("data-tc-label", "");
      label.textContent = "AI · " + (settings.incomingTargetLanguage || settings.targetLanguage) + (response.result.cached ? " · cache" : "");
      output.append(label, document.createTextNode(response.result.text));
      output.hidden = false;
      action.textContent = "Dịch lại";
    },
    onError: (error) => {
      renderError(output, error);
      output.hidden = false;
      action.textContent = "Thử lại";
    },
    isCurrent
  });
  if (isCurrent()) action.disabled = false;
  return result;
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

function composerText(editor) {
  return String(editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText || editor.textContent || "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function isVisibleElement(node) {
  if (!node) return false;
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function findSendControl(root) {
  return [...root.querySelectorAll("button,[role='button']")].find((node) => {
    if (node.matches("[data-schedule]")) return false;
    const label = String(node.getAttribute("aria-label") || "").trim().toLocaleLowerCase("vi-VN");
    if (label.includes("lên lịch") || label.includes("schedule")) return false;
    return node.matches("[data-send]") || SEND_LABELS.has(label);
  }) || null;
}

function composerControlShell(control) {
  return control?.closest("span[jsshadow]")
    || control?.closest("[data-action-shell]")
    || control?.parentElement
    || null;
}

function nearestSurfaceBackground(node, boundary) {
  for (let current = node; current && current !== boundary; current = current.parentElement) {
    const background = getComputedStyle(current).backgroundColor;
    if (background && background !== "rgba(0, 0, 0, 0)") return background;
  }
  return "";
}

function mountComposeButton(button, root, sendButton, visibleToolbar) {
  const mount = document.createElement("span");
  mount.setAttribute(UI_ATTR, "");
  mount.setAttribute("data-tc-compose-mount", "");
  mount.append(button);
  const sendShell = composerControlShell(sendButton);
  const shellRect = sendShell?.getBoundingClientRect();
  const width = shellRect && shellRect.width >= 40 && shellRect.width <= 80 ? shellRect.width : 68;
  const height = shellRect && shellRect.height >= 40 && shellRect.height <= 120 ? shellRect.height : null;
  mount.style.setProperty("width", width + "px", "important");
  mount.style.setProperty("min-width", width + "px", "important");
  mount.style.setProperty("max-width", width + "px", "important");
  mount.style.setProperty("inline-size", width + "px", "important");
  mount.style.setProperty("min-inline-size", width + "px", "important");
  mount.style.setProperty("max-inline-size", width + "px", "important");
  if (height) {
    mount.style.setProperty("height", height + "px", "important");
    mount.style.setProperty("min-height", height + "px", "important");
    mount.style.setProperty("max-height", height + "px", "important");
    mount.style.setProperty("block-size", height + "px", "important");
    mount.style.setProperty("min-block-size", height + "px", "important");
    mount.style.setProperty("max-block-size", height + "px", "important");
  }
  const nativeBackground = nearestSurfaceBackground(sendShell, root);
  if (nativeBackground && nativeBackground !== "rgba(0, 0, 0, 0)") {
    mount.style.setProperty("background-color", nativeBackground, "important");
  }
  if (visibleToolbar) {
    visibleToolbar.append(mount);
    return;
  }
  if (sendShell?.parentElement) {
    sendShell.parentElement.insertBefore(mount, sendShell);
  } else if (sendButton?.parentElement) {
    sendButton.parentElement.insertBefore(mount, sendButton);
  } else {
    root.append(mount);
  }
}

function composerRoot(editor) {
  const explicit = editor.closest("[data-composer]");
  if (explicit) return explicit;
  const googleRoot = editor.closest("[jsname='SFaVIf'],.I0LFzc");
  if (googleRoot) return googleRoot;
  let current = editor.parentElement;
  let toolbarRoot = null;
  for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
    if (current.querySelector("[role='toolbar']")) toolbarRoot ||= current;
    if (findSendControl(current)) return current;
  }
  return toolbarRoot || editor.closest("[data-thread-id]") || editor.parentElement;
}

function setComposerText(editor, text) {
  editor.focus();
  if (editor instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(editor, text);
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (!document.execCommand("insertText", false, text)) editor.replaceChildren(document.createTextNode(text));
  }
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function positionComposePanel(panel, root) {
  const rect = root.getBoundingClientRect();
  panel.style.left = Math.max(12, Math.min(window.innerWidth - panel.offsetWidth - 12, rect.right - panel.offsetWidth)) + "px";
  panel.style.top = Math.max(12, rect.top - panel.offsetHeight - 10) + "px";
}

function closeComposePanel(state) {
  state.panel?.remove();
  state.button?.setAttribute("aria-expanded", "false");
  state.panel = null;
}

function draftIsCurrent(state) {
  return composerText(state.editor) === state.draft;
}

function guardComposeDraft(state) {
  if (!state.panel) return true;
  const error = state.panel.querySelector("[data-tc-compose-error]");
  const insert = state.panel.querySelector("[data-tc-compose-insert]");
  const send = state.panel.querySelector("[data-tc-compose-send]");
  if (draftIsCurrent(state)) {
    if (error?.dataset.tcDraftChanged === "true") {
      error.textContent = "";
      delete error.dataset.tcDraftChanged;
    }
    return true;
  }
  if (error) {
    error.dataset.tcDraftChanged = "true";
    error.textContent = "Nội dung đã thay đổi. Hãy đóng popup và mở lại để dịch bản nháp mới.";
  }
  if (insert) insert.disabled = true;
  if (send) send.disabled = true;
  return false;
}

function sendComposer(state) {
  const button = findSendControl(state.root);
  if (button && !button.disabled) button.click();
  else state.editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
}

async function requestComposeTranslation(state) {
  if (!draftIsCurrent(state)) {
    guardComposeDraft(state);
    return;
  }
  const requestId = Symbol("compose");
  state.requestId = requestId;
  const panel = state.panel;
  const targetLanguage = panel.querySelector("[data-tc-compose-language]").value;
  const tone = panel.querySelector("[data-tc-compose-tone]").value;
  const preview = panel.querySelector("[data-tc-compose-preview]");
  const error = panel.querySelector("[data-tc-compose-error]");
  const insert = panel.querySelector("[data-tc-compose-insert]");
  const send = panel.querySelector("[data-tc-compose-send]");
  preview.textContent = "Đang dịch theo thread...";
  error.textContent = "";
  delete error.dataset.tcDraftChanged;
  const threadMessages = collectThread(state.threadId);
  panel.querySelector("[data-tc-compose-context]").textContent = threadMessages.length
    ? "Đang dùng context của thread · " + threadMessages.length + " message"
    : "Không tìm thấy message trong thread; dịch theo nội dung bản nháp";
  insert.disabled = true;
  send.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "COMPOSE_TRANSLATE",
      text: state.draft,
      sourceLanguage: settings.sourceLanguage,
      targetLanguage,
      tone,
      threadMessages
    });
    if (state.requestId !== requestId || !state.panel) return;
    if (!response?.ok || !response.result?.text) throw new Error(response?.error || "Không nhận được bản dịch");
    state.translation = response.result.text;
    preview.textContent = state.translation;
    insert.disabled = false;
    send.disabled = false;
    guardComposeDraft(state);
  } catch (composeError) {
    if (state.requestId !== requestId || !state.panel) return;
    preview.textContent = "";
    error.textContent = composeError.message || "Không thể dịch nội dung";
  }
}

function openComposePanel(state) {
  closeComposePanel(state);
  state.draft = composerText(state.editor);
  if (!state.draft) return;
  const panel = document.createElement("section");
  panel.setAttribute(UI_ATTR, "");
  panel.setAttribute("data-tc-compose-panel", "");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Dịch nội dung đang soạn");
  panel.innerHTML = "<header><strong>Dịch trước khi gửi</strong><button type='button' data-tc-compose-close aria-label='Đóng'>×</button></header>" +
    "<label>Ngôn ngữ đích</label><select data-tc-compose-language><option value='vi'>Tiếng Việt</option><option value='en'>English</option><option value='ja'>日本語</option><option value='ko'>한국어</option></select>" +
    "<label>Phong thái</label><select data-tc-compose-tone><option value='natural'>Tự nhiên</option><option value='formal'>Lịch sự, trang trọng</option><option value='warm'>Đầy đủ chào hỏi</option><option value='concise'>Ngắn gọn, xúc tích</option></select>" +
    "<div data-tc-compose-context>Đang dùng context của thread</div>" +
    "<div data-tc-compose-block><span>Nội dung đang soạn</span><p data-tc-compose-source></p></div>" +
    "<div data-tc-compose-block><span>Bản dịch xem trước</span><p data-tc-compose-preview></p><div data-tc-compose-error role='alert'></div></div>" +
    "<footer><button type='button' data-tc-compose-cancel>Hủy</button><button type='button' data-tc-compose-insert disabled>Chèn vào ô soạn</button><button type='button' data-tc-compose-send disabled>Dịch &amp; gửi</button></footer>";
  document.body.append(panel);
  state.panel = panel;
  panel.querySelector("[data-tc-compose-language]").value = settings.outgoingTargetLanguage || "ja";
  panel.querySelector("[data-tc-compose-source]").textContent = state.draft;
  panel.querySelector("[data-tc-compose-close]").addEventListener("click", () => closeComposePanel(state));
  panel.querySelector("[data-tc-compose-cancel]").addEventListener("click", () => closeComposePanel(state));
  panel.querySelector("[data-tc-compose-language]").addEventListener("change", () => requestComposeTranslation(state));
  panel.querySelector("[data-tc-compose-tone]").addEventListener("change", () => requestComposeTranslation(state));
  panel.querySelector("[data-tc-compose-insert]").addEventListener("click", () => {
    if (!guardComposeDraft(state)) return;
    setComposerText(state.editor, state.translation);
    closeComposePanel(state);
  });
  panel.querySelector("[data-tc-compose-send]").addEventListener("click", () => {
    if (!guardComposeDraft(state)) return;
    setComposerText(state.editor, state.translation);
    sendComposer(state);
    closeComposePanel(state);
  });
  state.button.setAttribute("aria-expanded", "true");
  positionComposePanel(panel, state.root);
  requestComposeTranslation(state);
}

function scanComposers() {
  if (!settings.enabled || !roomEnabled) return;
  [...document.querySelectorAll("[contenteditable='true'],textarea")]
    .filter((editor) => !editor.closest("[" + UI_ATTR + "]") && (editor.offsetWidth || editor.offsetHeight || editor.getClientRects().length))
    .forEach((editor) => {
      const root = composerRoot(editor);
      if (!root || root.querySelector("[data-tc-compose-button]")) return;
      const sendButton = findSendControl(root);
      const visibleToolbar = [...root.querySelectorAll("[data-composer-toolbar],[role='toolbar']")].find(isVisibleElement);
      if (!root.matches("[data-composer]") && !sendButton && !visibleToolbar) return;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute(UI_ATTR, "");
      button.setAttribute("data-tc-compose-button", "");
      button.setAttribute("aria-label", "Dịch nội dung đang soạn");
      button.title = "Dịch nội dung đang soạn";
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M7 5h10v2H7v3l-4-4 4-4v3Zm10 14H7v-2h10v-3l4 4-4 4v-3Z'/></svg>";
      const state = { editor, root, button, threadId: editor.dataset.threadId || root.dataset.threadId || root.closest("[data-thread-id]")?.dataset.threadId || "" };
      composeStates.set(button, state);
      state.editor.addEventListener("input", () => guardComposeDraft(state));
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (state.panel) closeComposePanel(state);
        else openComposePanel(state);
      });
      mountComposeButton(button, root, sendButton, visibleToolbar);
    });
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

function renderSummaryError(card, error) {
  let errorNode = card.querySelector("[data-tc-summary-error]");
  if (!errorNode) {
    errorNode = document.createElement("div");
    errorNode.setAttribute("data-tc-summary-error", "");
    const body = card.querySelector("[data-tc-summary-body]");
    body.after(errorNode);
  }
  errorNode.textContent = toUserError(error).message + " Nhấn Cập nhật để thử lại.";
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
  const card = activeSummary.card;
  const operationId = Symbol("summary");
  activeSummary.operationId = operationId;
  const isCurrent = () => activeSummary?.operationId === operationId && activeSummary.card === card && card.isConnected;
  const oldError = card.querySelector("[data-tc-summary-error]");
  if (oldError) oldError.remove();
  const result = await runUiOperation({
    request: () => send({ type: "SUMMARY", threadId: activeSummary.threadId, messages: requestMessages, previousSummary: activeSummary.summary }),
    onLoading: () => {
      if (!activeSummary.summary) body.textContent = "Đang tóm tắt...";
    },
    onSuccess: (response) => {
      if (!response.result?.text) throw new Error("Summary response missing content");
    activeSummary.summary = response.result.text;
    activeSummary.fingerprint = nextFingerprint;
    const oldStale = activeSummary.card.querySelector("[data-tc-stale]");
    if (oldStale) oldStale.remove();
    body.textContent = response.result.text;
    },
    onError: (error) => {
      if (!activeSummary.summary) body.textContent = "";
      renderSummaryError(card, error);
    },
    isCurrent
  });
  return result;
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
  scanComposers();
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

function handleRuntimeMessage(message, _sender, sendResponse) {
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
}

globalThis.chrome?.runtime?.onMessage?.addListener?.(handleRuntimeMessage);

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
  globalThis.chrome?.storage?.onChanged?.addListener?.((changes, area) => {
    if (area !== "local" || !changes.settings) return;
    settings = changes.settings.newValue || settings;
    refreshRoomGate();
    scan();
  });
}

boot();
