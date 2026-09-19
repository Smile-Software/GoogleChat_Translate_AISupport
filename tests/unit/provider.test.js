import test from "node:test";
import assert from "node:assert/strict";
import { buildSummaryMessages, buildTranslationMessages, listModels } from "../../src/provider/openai-compatible.js";

test("sorts luna models first and removes duplicates", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ data: [{ id: "beta" }, { id: "luna-pro" }, { id: "beta" }, { id: "alpha" }] }), { status: 200 });
  const models = await listModels({ baseUrl: "https://provider.test/v1", apiKey: "test", requestTimeoutMs: 1000 }, fetchImpl);
  assert.deepEqual(models, ["luna-pro", "alpha", "beta"]);
});

test("builds translation-only prompt", () => {
  const messages = buildTranslationMessages("こんにちは", "ja", "vi");
  assert.match(messages[0].content, /vi/);
  assert.match(messages[1].content, /こんにちは/);
});

test("includes previous summary for incremental update", () => {
  const messages = buildSummaryMessages([{ author: "A", time: "10:00", text: "New" }], "vi", "short", "Old");
  assert.match(messages[1].content, /Previous summary/);
  assert.match(messages[1].content, /New/);
});
