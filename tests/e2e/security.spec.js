import { test, expect } from "playwright/test";
import { launchConfiguredApp } from "./helpers.js";

test("masks credential-like text before provider request", async () => {
  const app = await launchConfiguredApp();
  try {
    const node = app.page.locator("[data-message-id='m-1']");
    await node.evaluate((element) => {
      element.dataset.messageId = "secret-message";
      element.dataset.text = "Password: SECRET_VALUE";
    });
    const secretNode = app.page.locator("[data-message-id='secret-message']");
    await secretNode.locator("[data-tc-action]").click();
    await expect(secretNode.locator("[data-tc-translation]")).toBeVisible();
    const request = app.provider.requests.find((item) => item.url === "/v1/chat/completions");
    expect(request.body).not.toContain("SECRET_VALUE");
    expect(request.body).toContain("[REDACTED]");
  } finally {
    await app.close();
  }
});

test("translates only the message body and mounts controls outside the host action area", async () => {
  const app = await launchConfiguredApp();
  try {
    const message = app.page.locator(".live-message-shell:not(.quote-message-shell)");
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-translation]")).toBeVisible();
    const request = app.provider.requests.find((item) => item.url === "/v1/chat/completions");
    expect(request.body).toContain("午後にトヨタで確認してもらいます。");
    expect(request.body).not.toContain("Người dùng bên ngoài không do quản trị viên quản lý");
    expect(request.body).not.toContain("domain_disabled");
    expect(await message.locator("[data-message-actions] [data-tc-ui]").count()).toBe(0);
    expect(await message.locator("[data-tc-surface] [data-tc-action]").count()).toBe(1);
  } finally {
    await app.close();
  }
});

test("does not send quoted message content for translation", async () => {
  const app = await launchConfiguredApp();
  try {
    const message = app.page.locator(".quote-message-shell");
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-translation]")).toBeVisible();
    const request = app.provider.requests.find((item) => item.url === "/v1/chat/completions" && item.body.includes("新しいメッセージ"));
    expect(request).toBeTruthy();
    expect(request.body).toContain("これは新しいメッセージだけです。");
    expect(request.body).not.toContain("引用された古いメッセージです。");
    expect(request.body).not.toContain("đã trích dẫn");
    expect(request.body).not.toContain("Kết thúc trích dẫn");
    expect(request.body).not.toContain("hãy nhấn L để liên kết trở lại với tin nhắn ban đầu");
  } finally {
    await app.close();
  }
});
