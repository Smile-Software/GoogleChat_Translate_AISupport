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
    await expect(popup.locator("#model")).toHaveValue("luna-fast");
    await popup.locator("#target").selectOption("en");
    await expect(popup.locator("#status")).toContainText("Provider");
    await popup.close();
  } finally {
    await app.close();
  }
});
