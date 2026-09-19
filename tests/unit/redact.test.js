import test from "node:test";
import assert from "node:assert/strict";
import { redactSensitive, REDACTED } from "../../src/security/redact.js";

test("masks password values", () => {
  const result = redactSensitive("User: demo Password: SECRET_VALUE");
  assert.equal(result.redacted, true);
  assert.equal(result.text, "User: demo Password: " + REDACTED);
  assert.doesNotMatch(result.text, /SECRET_VALUE/);
});

test("masks bearer and api key values", () => {
  const result = redactSensitive("Authorization: Bearer TOKEN api_key=KEY");
  assert.equal(result.text, "Authorization: Bearer " + REDACTED + " api_key=" + REDACTED);
});

test("leaves ordinary text unchanged", () => {
  const result = redactSensitive("作業中 問題あり。");
  assert.equal(result.redacted, false);
  assert.equal(result.text, "作業中 問題あり。");
});
