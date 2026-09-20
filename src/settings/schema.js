import { normalizeRoomAllowlist } from "./rooms.js";

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  sourceLanguage: "auto",
  targetLanguage: "vi",
  incomingTargetLanguage: "vi",
  outgoingTargetLanguage: "ja",
  summaryLanguage: "vi",
  summaryLength: "medium",
  autoTranslate: true,
  showOriginal: true,
  autoSummary: false,
  maskCredentials: true,
  cacheTtlDays: 7,
  requestTimeoutMs: 20000,
  baseUrl: "",
  apiKey: "",
  model: "",
  roomAllowlist: {}
});

export function normalizeSettings(input = {}) {
  const value = { ...DEFAULT_SETTINGS, ...input };
  const incomingTargetLanguage = String(input.incomingTargetLanguage || input.targetLanguage || value.incomingTargetLanguage || "vi");
  const outgoingTargetLanguage = String(input.outgoingTargetLanguage || value.outgoingTargetLanguage || "ja");
  const ttl = Number(value.cacheTtlDays);
  const timeout = Number(value.requestTimeoutMs);
  return {
    ...value,
    sourceLanguage: String(value.sourceLanguage || "auto"),
    targetLanguage: incomingTargetLanguage,
    incomingTargetLanguage,
    outgoingTargetLanguage,
    summaryLanguage: String(value.summaryLanguage || "vi"),
    summaryLength: ["short", "medium", "long"].includes(value.summaryLength) ? value.summaryLength : "medium",
    enabled: Boolean(value.enabled),
    autoTranslate: Boolean(value.autoTranslate),
    showOriginal: Boolean(value.showOriginal),
    autoSummary: Boolean(value.autoSummary),
    maskCredentials: value.maskCredentials !== false,
    cacheTtlDays: Number.isFinite(ttl) ? Math.min(30, Math.max(1, ttl)) : 7,
    requestTimeoutMs: Number.isFinite(timeout) ? Math.min(120000, Math.max(1000, timeout)) : 20000,
    baseUrl: String(value.baseUrl || "").trim().replace(/\/+$/, ""),
    apiKey: String(value.apiKey || ""),
    model: String(value.model || "").trim(),
    roomAllowlist: normalizeRoomAllowlist(value.roomAllowlist)
  };
}

export function validateSettings(input) {
  const settings = normalizeSettings(input);
  const errors = {};
  if (!settings.baseUrl) errors.baseUrl = "Base URL is required";
  else {
    try {
      const url = new URL(settings.baseUrl);
      if (!["http:", "https:"].includes(url.protocol)) errors.baseUrl = "Use HTTP or HTTPS URL";
    } catch {
      errors.baseUrl = "Enter a valid URL";
    }
  }
  if (!settings.apiKey.trim()) errors.apiKey = "API key is required";
  if (!settings.model) errors.model = "Model is required";
  return { settings, errors, valid: Object.keys(errors).length === 0 };
}
