import test from "node:test";
import assert from "node:assert/strict";
import "../../src/content/message-surface.js";

const {
  findMessageRenderTarget,
  isMainMessageNode,
  isTranslatableMessageNode,
  keepSingleMessageSurface
} = globalThis.TranslateChatMessageSurface;

test("mounts UI in the message bubble flow below the message body", () => {
  const bubble = { name: "bubble" };
  const contentWrapper = { name: "content-wrapper" };
  const host = {
    querySelector(selector) {
      if (selector.includes("bgckF")) return bubble;
      if (selector === ".EAOoq") return contentWrapper;
      return null;
    }
  };
  const marker = {
    closest(selector) {
      return selector === ".F0wyae" ? host : null;
    }
  };

  assert.equal(findMessageRenderTarget(marker), contentWrapper);
});

test("falls back to the message node for fixture messages", () => {
  const marker = {
    closest() { return null; },
    querySelector() { return null; }
  };

  assert.equal(findMessageRenderTarget(marker), marker);
});

test("accepts main message markers and rejects thread detail markers", () => {
  const main = {
    getAttribute(name) { return name === "jsname" ? "oU6v8b" : null; },
    hasAttribute() { return false; },
    closest() { return null; }
  };
  const reply = {
    getAttribute(name) { return name === "jsname" ? "oU6v8b" : null; },
    hasAttribute() { return false; },
    closest(selector) { return selector === '[data-is-detailed-thread-view="true"]' ? {} : null; }
  };

  assert.equal(isMainMessageNode(main), true);
  assert.equal(isMainMessageNode(reply), false);
});

test("accepts messages inside a detailed thread for translation", () => {
  const main = {
    closest() { return null; }
  };
  const reply = {
    closest(selector) {
      return selector === '[data-is-detailed-thread-view="true"]' ? {} : null;
    }
  };

  assert.equal(isTranslatableMessageNode(main), true);
  assert.equal(isTranslatableMessageNode(reply), true);
});

test("keeps only one injected surface in a message target", () => {
  const removed = [];
  const surfaces = [
    { remove() { removed.push("first"); } },
    { remove() { removed.push("second"); } },
    { remove() { removed.push("third"); } }
  ];
  const target = { querySelectorAll() { return surfaces; } };

  assert.equal(keepSingleMessageSurface(target), surfaces[0]);
  assert.deepEqual(removed, ["second", "third"]);
});
