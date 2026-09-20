import { normalizeSettings } from "../settings/schema.js";
import { setRoomEnabled } from "../settings/rooms.js";
import { redactSensitive } from "../security/redact.js";
import {
  buildContextAwareTranslationMessages,
  buildComposeTranslationMessages,
  buildSummaryMessages,
  chatCompletion,
  listModels
} from "../provider/openai-compatible.js";
import { cacheStats, clearCache, getCache, putCache } from "../cache/indexed-db.js";

const fallbackMemory = new Map();

async function settings() {
  const stored = await chrome.storage.local.get("settings");
  return normalizeSettings(stored.settings);
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readCache(key) {
  try {
    const entry = await getCache(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) return null;
    return entry;
  } catch {
    return fallbackMemory.get(key) || null;
  }
}

async function writeCache(entry) {
  try {
    await putCache(entry);
  } catch {
    fallbackMemory.set(entry.key, entry);
  }
}

function safeMessages(messages, config) {
  return (Array.isArray(messages) ? messages : []).map((item) => {
    const safe = config.maskCredentials ? redactSensitive(item.text) : { text: item.text };
    return { ...item, text: safe.text };
  }).filter((item) => String(item.text || "").trim());
}

async function translate(request) {
  const config = await settings();
  const safe = config.maskCredentials ? redactSensitive(request.text) : { text: request.text, redacted: false };
  const threadMessages = safeMessages(request.threadMessages, config);
  const key = "translation:" + await digest(JSON.stringify([
    safe.text,
    request.sourceLanguage,
    request.targetLanguage,
    threadMessages.map((item) => [item.id, item.author, item.time, item.text]),
    config.model,
    "v2"
  ]));
  const cached = await readCache(key);
  if (cached) return { text: cached.value, cached: true, redacted: safe.redacted };
  if (!config.baseUrl || !config.apiKey || !config.model) throw new Error("Configure provider in Settings");
  const value = await chatCompletion(config, buildContextAwareTranslationMessages({
    text: safe.text,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    threadMessages
  }));
  await writeCache({ key, kind: "translation", value, expiresAt: Date.now() + config.cacheTtlDays * 86400000 });
  return { text: value, cached: false, redacted: safe.redacted };
}

async function composeTranslate(request) {
  const config = await settings();
  const safe = config.maskCredentials ? redactSensitive(request.text) : { text: request.text, redacted: false };
  const threadMessages = safeMessages(request.threadMessages, config);
  const key = "compose-translation:" + await digest(JSON.stringify([
    safe.text,
    request.sourceLanguage,
    request.targetLanguage,
    request.tone,
    threadMessages.map((item) => [item.id, item.author, item.time, item.text]),
    config.model,
    "v1"
  ]));
  const cached = await readCache(key);
  if (cached) return { text: cached.value, cached: true, redacted: safe.redacted };
  if (!config.baseUrl || !config.apiKey || !config.model) throw new Error("Configure provider in Settings");
  const value = await chatCompletion(config, buildComposeTranslationMessages({
    text: safe.text,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    tone: request.tone,
    threadMessages
  }));
  await writeCache({ key, kind: "compose-translation", value, expiresAt: Date.now() + config.cacheTtlDays * 86400000 });
  return { text: value, cached: false, redacted: safe.redacted };
}

async function summarize(request) {
  const config = await settings();
  const messages = request.messages.map((item) => {
    const safe = config.maskCredentials ? redactSensitive(item.text) : { text: item.text };
    return { ...item, text: safe.text };
  });
  const fingerprint = await digest(JSON.stringify([
    request.threadId,
    messages.map((item) => [item.id, item.author, item.time, item.text]),
    config.model,
    config.summaryLanguage,
    config.summaryLength,
    "v1"
  ]));
  const key = "summary:" + fingerprint;
  const cached = await readCache(key);
  if (cached) return { text: cached.value, cached: true, fingerprint };
  if (!config.baseUrl || !config.apiKey || !config.model) throw new Error("Configure provider in Settings");
  const value = await chatCompletion(config, buildSummaryMessages(messages, config.summaryLanguage, config.summaryLength, request.previousSummary || ""));
  await writeCache({ key, kind: "summary", value, expiresAt: Date.now() + config.cacheTtlDays * 86400000 });
  return { text: value, cached: false, fingerprint };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "GET_SETTINGS") sendResponse({ ok: true, settings: await settings() });
      else if (message.type === "SAVE_SETTINGS") {
        const next = normalizeSettings(message.settings);
        await chrome.storage.local.set({ settings: next });
        sendResponse({ ok: true, settings: next });
      } else if (message.type === "SET_ROOM_ENABLED") {
        const current = await settings();
        const next = normalizeSettings(setRoomEnabled(current, message.roomId, message.label, message.enabled));
        await chrome.storage.local.set({ settings: next });
        sendResponse({ ok: true, settings: next, enabled: Boolean(next.roomAllowlist[message.roomId]) });
      } else if (message.type === "LIST_MODELS") sendResponse({ ok: true, models: await listModels(await settings()) });
      else if (message.type === "TRANSLATE") sendResponse({ ok: true, result: await translate(message) });
      else if (message.type === "COMPOSE_TRANSLATE") sendResponse({ ok: true, result: await composeTranslate(message) });
      else if (message.type === "SUMMARY") sendResponse({ ok: true, result: await summarize(message) });
      else if (message.type === "CLEAR_CACHE") {
        await clearCache(message.kind);
        sendResponse({ ok: true });
      } else if (message.type === "CACHE_STATS") sendResponse({ ok: true, stats: await cacheStats() });
      else sendResponse({ ok: false, error: "Unknown message", code: "UNKNOWN_MESSAGE", retryable: false });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.userMessage || error.message || "Request failed",
        status: error.status || 0,
        code: error.code || "REQUEST_FAILED",
        retryable: Boolean(error.retryable)
      });
    }
  })();
  return true;
});
