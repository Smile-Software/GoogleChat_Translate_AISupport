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

test("shows the compose translation button in the visible Google Chat action row", async () => {
  const app = await launchConfiguredApp({ autoTranslate: false });
  try {
    const composer = app.page.locator("[data-real-composer]");
    await expect(composer.locator("[data-tc-compose-button]")).toHaveCount(1);
    await expect(composer.locator("[data-tc-compose-button]")).toBeVisible();
    await expect(composer.locator("[data-tc-compose-mount]")).toHaveCount(1);
    await expect(composer.locator("[data-send-shell] [data-tc-compose-mount]")).toHaveCount(0);
    await expect.poll(async () => composer.locator("[data-tc-compose-mount]").evaluate((node) => {
      const shell = node.closest("[data-action-row]").querySelector("[data-send-shell]");
      const nodeRect = node.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const style = getComputedStyle(node);
      return [style.backgroundColor, style.borderRadius, style.marginLeft, style.marginRight, style.minWidth, style.maxWidth, nodeRect.width, nodeRect.height, shellRect.width, shellRect.height];
    })).toEqual(["rgb(234, 240, 255)", "8px", "-4px", "-4px", "68px", "68px", 68, 108, 68, 108]);
  } finally {
    await app.close();
  }
});

test("opens the compose translation popup with thread context", async () => {
  const app = await launchConfiguredApp({ autoTranslate: false });
  try {
    const editor = app.page.locator("[data-testid='composer-editor']");
    await editor.fill("午後にトヨタで確認してもらいます。");
    await app.page.locator("[data-tc-compose-button]").click();
    const panel = app.page.locator("[data-tc-compose-panel]");
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-tc-compose-context]")).toContainText("context của thread");
    await expect(panel.locator("[data-tc-compose-preview]")).toContainText("Chiều nay sẽ nhờ Toyota");
  } finally {
    await app.close();
  }
});

test("defaults outgoing drafts to Japanese while incoming translations stay Vietnamese", async () => {
  const app = await launchConfiguredApp({ autoTranslate: false });
  try {
    const editor = app.page.locator("[data-testid='composer-editor']");
    await editor.fill("Tôi sẽ kiểm tra và phản hồi sau.");
    await app.page.locator("[data-tc-compose-button]").click();

    await expect(app.page.locator("[data-tc-compose-language]")).toHaveValue("ja");
    await expect(app.page.locator("[data-message-id='m-1'] [data-tc-action]")).toHaveText("Dịch");
  } finally {
    await app.close();
  }
});

test("sends through the message button instead of schedule send", async () => {
  const app = await launchConfiguredApp({ autoTranslate: false });
  try {
    const editor = app.page.locator("[data-testid='composer-editor']");
    const composer = app.page.locator("[data-real-composer]");

    await editor.fill("午後にトヨタで確認してもらいます。");
    await app.page.locator("[data-tc-compose-button]").click();
    await app.page.locator("[data-tc-compose-send]").click();

    await expect(composer).toHaveAttribute("data-send-clicked", "true");
    await expect(composer).not.toHaveAttribute("data-schedule-clicked", "true");
  } finally {
    await app.close();
  }
});
