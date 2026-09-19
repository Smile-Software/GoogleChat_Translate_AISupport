import test from "node:test";
import assert from "node:assert/strict";

function fingerprint(messages) {
  return JSON.stringify(messages.map((item) => [item.id, item.author, item.time, item.text]));
}

test("new reply changes thread fingerprint", () => {
  const before = [{ id: "m-1", author: "A", time: "10:00", text: "one" }];
  const after = [...before, { id: "m-2", author: "B", time: "10:01", text: "two" }];
  assert.notEqual(fingerprint(before), fingerprint(after));
});

test("editing existing message changes fingerprint", () => {
  const before = [{ id: "m-1", author: "A", time: "10:00", text: "one" }];
  const after = [{ id: "m-1", author: "A", time: "10:00", text: "edited" }];
  assert.notEqual(fingerprint(before), fingerprint(after));
});
