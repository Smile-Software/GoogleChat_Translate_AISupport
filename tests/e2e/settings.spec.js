import { test, expect } from "playwright/test";
import { launchConfiguredApp } from "./helpers.js";

test("popup exposes target language and luna-first model", async () => {
  const app = await launchConfiguredApp();
  try {
    const worker = app.context.serviceWorkers()[0];
    const id = new URL(worker.url()).hostname;
    const popup = await app.context.newPage();
    await popup.goto("chrome-extension://" + id + "/src/popup/popup.html");
    await expect(popup.locator("#target")).toHaveValue("vi");
    await expect(popup.locator("#outgoing-target")).toHaveValue("ja");
    await expect(popup.locator("#model")).toHaveValue("luna-fast");
    await popup.locator("#target").selectOption("en");
    await popup.locator("#outgoing-target").selectOption("ja");
    await expect(popup.locator("#status")).toContainText("Provider");
    await popup.close();
  } finally {
    await app.close();
  }
});

test("popup shows room context status and allows manual refresh", async () => {
  const app = await launchConfiguredApp();
  try {
    const worker = app.context.serviceWorkers()[0];
    const id = new URL(worker.url()).hostname;
    const popup = await app.context.newPage();
    await popup.goto("chrome-extension://" + id + "/src/popup/popup.html");
    await expect(popup.locator("#context-status")).toHaveText("Chưa tạo");
    await expect(popup.locator("#context-refresh")).toBeEnabled();
    await app.page.locator("[data-message-id='m-1'] [data-tc-action]").click();
    await expect.poll(async () => popup.locator("#context-status").textContent()).toBe("Sẵn sàng");
    await expect(popup.locator("#context-updated")).toContainText("Cập nhật:");
    await popup.close();
  } finally {
    await app.close();
  }
});
