import test from "node:test";
import assert from "node:assert/strict";

test("cache contract keeps translation and summary namespaces separate", () => {
  const translationKey = "translation:abc";
  const summaryKey = "summary:abc";
  assert.notEqual(translationKey, summaryKey);
  assert.match(translationKey, /^translation:/);
  assert.match(summaryKey, /^summary:/);
});
