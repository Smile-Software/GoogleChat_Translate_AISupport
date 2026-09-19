import { test, expect } from "playwright/test";
import { launchConfiguredApp } from "./helpers.js";

test("adds summary action to three-dot menu and keeps summary private", async () => {
  const app = await launchConfiguredApp();
  try {
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-menu]").click();
    const action = message.locator("[data-menu-popup] [data-tc-menu-item]");
    await expect(action).toHaveText("Tóm tắt thread bằng AI");
    await action.click();
    await expect(app.page.locator("[data-tc-summary-card]")).toContainText("Tóm tắt:");
    expect(await app.page.locator("[data-message-id][data-text]").count()).toBe(3);
    expect(await app.page.locator("text=Tóm tắt:").count()).toBe(1);
  } finally {
    await app.close();
  }
});

test("marks summary stale and updates with new messages", async () => {
  const app = await launchConfiguredApp();
  try {
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-menu]").click();
    await message.locator("[data-tc-menu-item]").click();
    await expect(app.page.locator("[data-tc-summary-card]")).toContainText("Tóm tắt:");
    const before = app.provider.requests.length;
    await app.page.locator("#add-reply").click();
    await expect(app.page.locator("[data-tc-stale]")).toContainText("message mới");
    await app.page.locator("[data-tc-summary-card] [data-tc-primary]").click();
    await expect(app.page.locator("[data-tc-summary-card]")).toContainText("Tóm tắt:");
    const updateRequest = app.provider.requests.slice(before).find((request) => request.url === "/v1/chat/completions");
    expect(updateRequest.body).toContain("追加の確認");
  } finally {
    await app.close();
  }
});
