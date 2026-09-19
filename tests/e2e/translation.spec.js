import { test, expect } from "playwright/test";
import { launchConfiguredApp } from "./helpers.js";

test("translates Japanese message inline and reuses cache", async () => {
  const app = await launchConfiguredApp({ autoTranslate: true });
  try {
    const message = app.page.locator("[data-message-id='m-1']");
    await expect(message.locator("[data-tc-translation]")).toContainText("Chiều nay sẽ nhờ Toyota");
    const calls = app.provider.requests.filter((request) => request.url === "/v1/chat/completions").length;
    await app.page.reload();
    await expect(app.page.locator("[data-message-id='m-1'] [data-tc-translation]")).toContainText("Chiều nay sẽ nhờ Toyota");
    expect(app.provider.requests.filter((request) => request.url === "/v1/chat/completions").length).toBe(calls);
  } finally {
    await app.close();
  }
});

test("auto translates newly added messages", async () => {
  const app = await launchConfiguredApp({ autoTranslate: true });
  try {
    await expect(app.page.locator("[data-message-id='m-1'] [data-tc-translation]")).toContainText("Chiều nay sẽ nhờ Toyota");
    await app.page.locator("#add-reply").click();
    await expect(app.page.locator("[data-message-id^='m-'] [data-tc-translation]").last()).toContainText("Bản dịch kiểm thử");
  } finally {
    await app.close();
  }
});

test("auto translates messages when a child thread is opened", async () => {
  const app = await launchConfiguredApp({ autoTranslate: true });
  try {
    await app.page.locator("#open-thread").click();
    const thread = app.page.locator('[data-is-detailed-thread-view="true"]');
    await expect(thread.locator("[data-message-id='thread-m-1'] [data-tc-translation]")).toContainText("Bản dịch kiểm thử");
  } finally {
    await app.close();
  }
});
