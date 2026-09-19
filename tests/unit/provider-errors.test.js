import test from "node:test";
import assert from "node:assert/strict";
import { ProviderError, chatCompletion, requestJson } from "../../src/provider/openai-compatible.js";

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { "content-type": "application/json", ...headers } });
}

test("classifies authentication failures without exposing provider body", async () => {
  await assert.rejects(
    () => requestJson("https://provider.test/v1/models", {}, 1000, async () => response(JSON.stringify({ error: { message: "secret provider detail" } }), 401)),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "AUTH");
      assert.equal(error.status, 401);
      assert.equal(error.retryable, false);
      assert.match(error.userMessage, /API key|authentication/i);
      assert.doesNotMatch(error.userMessage, /secret provider detail/);
      return true;
    }
  );
});

test("classifies rate limits and server failures as retryable", async () => {
  for (const [status, code] of [[429, "RATE_LIMIT"], [500, "SERVER"]]) {
    await assert.rejects(
      () => requestJson("https://provider.test/v1/models", {}, 1000, async () => response("{}", status)),
      (error) => error instanceof ProviderError && error.code === code && error.status === status && error.retryable
    );
  }
});

test("classifies aborts and network failures safely", async () => {
  await assert.rejects(
    () => requestJson("https://provider.test/v1/models", {}, 1000, async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }),
    (error) => error instanceof ProviderError && error.code === "TIMEOUT" && error.retryable
  );
  await assert.rejects(
    () => requestJson("https://provider.test/v1/models", {}, 1000, async () => { throw new Error("socket detail"); }),
    (error) => error instanceof ProviderError && error.code === "NETWORK" && error.retryable && !error.userMessage.includes("socket detail")
  );
});

test("rejects malformed JSON and missing completion content", async () => {
  await assert.rejects(
    () => requestJson("https://provider.test/v1/models", {}, 1000, async () => response("not-json")),
    (error) => error instanceof ProviderError && error.code === "MALFORMED_RESPONSE" && !error.retryable
  );
  await assert.rejects(
    () => chatCompletion({ baseUrl: "https://provider.test/v1", apiKey: "key", model: "luna", requestTimeoutMs: 1000 }, [], async () => response(JSON.stringify({ choices: [{}] }))),
    (error) => error instanceof ProviderError && error.code === "MALFORMED_RESPONSE" && !error.retryable
  );
});
