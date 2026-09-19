import test from "node:test";
import assert from "node:assert/strict";
import "../../src/content/message-text.js";

const { cleanMessageText } = globalThis.TranslateChatMessageText;

test("removes external-user metadata but keeps Japanese message text", () => {
  const raw = "小野和夫\nNgười dùng bên ngoài không do quản trị viên quản lý\n午後にトヨタで確認してもらいます。少々お待ちください\nHôm qua 10:29";
  assert.equal(
    cleanMessageText(raw, { author: "小野和夫", time: "Hôm qua 10:29" }),
    "午後にトヨタで確認してもらいます。少々お待ちください"
  );
});

test("removes domain status and reply metadata from a short message", () => {
  const raw = "小野和夫, domain_disabled\n了解致しました\n1 tin nhắn trả lời, Câu trả lời cuối cùng Hôm qua 14:38";
  assert.equal(cleanMessageText(raw, { author: "小野和夫" }), "了解致しました");
});

test("does not remove an ordinary body sentence", () => {
  assert.equal(cleanMessageText("作業中 問題あり。teams参照して対応してください", { author: "小野和夫" }), "作業中 問題あり。teams参照して対応してください");
});
