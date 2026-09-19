import test from "node:test";
import assert from "node:assert/strict";
import "../../src/content/operation-state.js";

const { runUiOperation, toUserError } = globalThis.TranslateChatOperationState;

test("runs loading and success callbacks for the current operation", async () => {
  const states = [];
  const result = await runUiOperation({
    request: async () => "translated",
    onLoading: () => states.push("loading"),
    onSuccess: (value) => states.push("success:" + value)
  });

  assert.deepEqual(states, ["loading", "success:translated"]);
  assert.deepEqual(result, { state: "success", value: "translated" });
});

test("converts failures to safe user errors", async () => {
  const errors = [];
  const result = await runUiOperation({
    request: async () => { throw { code: "RATE_LIMIT", userMessage: "Try later", retryable: true }; },
    onError: (error) => errors.push(error)
  });

  assert.deepEqual(errors, [{ code: "RATE_LIMIT", message: "Try later", retryable: true }]);
  assert.equal(result.state, "error");
});

test("does not render a stale success or error", async () => {
  let current = false;
  const states = [];
  const success = await runUiOperation({
    request: async () => "late",
    isCurrent: () => current,
    onSuccess: () => states.push("success"),
    onError: () => states.push("error")
  });
  assert.deepEqual(success, { state: "stale", value: "late" });
  assert.deepEqual(states, []);

  const error = await runUiOperation({
    request: async () => { throw new Error("late failure"); },
    isCurrent: () => current,
    onError: () => states.push("error")
  });
  assert.equal(error.state, "stale");
  assert.deepEqual(states, []);
});

test("falls back to a generic message for unknown errors", () => {
  assert.deepEqual(toUserError(null), { code: "UNKNOWN", message: "Không thể xử lý", retryable: false });
});
