import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, normalizeSettings, validateSettings } from "../../src/settings/schema.js";

test("normalizes defaults", () => {
  const value = normalizeSettings();
  assert.equal(value.targetLanguage, "vi");
  assert.equal(value.cacheTtlDays, 7);
  assert.equal(value.maskCredentials, true);
});

test("clamps unsafe cache and timeout values", () => {
  const value = normalizeSettings({ cacheTtlDays: 500, requestTimeoutMs: 1 });
  assert.equal(value.cacheTtlDays, 30);
  assert.equal(value.requestTimeoutMs, 1000);
});

test("validates provider settings", () => {
  assert.equal(validateSettings(DEFAULT_SETTINGS).valid, false);
  assert.equal(validateSettings({ baseUrl: "https://provider.test/v1", apiKey: "k", model: "luna" }).valid, true);
});
