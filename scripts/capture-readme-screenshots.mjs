import fs from "node:fs/promises";
import path from "node:path";
import { launchConfiguredApp } from "../tests/e2e/helpers.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outputDir = path.join(root, "docs", "screenshots");

async function waitFor(locator) {
  await locator.waitFor({ state: "visible" });
}

async function capture() {
  await fs.mkdir(outputDir, { recursive: true });

  let app;
  try {
    app = await launchConfiguredApp({ autoTranslate: true });
    await app.page.setViewportSize({ width: 1280, height: 900 });
    const mainTranslation = app.page.locator("[data-message-id='m-1'] [data-tc-translation]");
    await waitFor(mainTranslation);
    await app.page.screenshot({ path: path.join(outputDir, "02-inline-translation.png"), fullPage: true });

    await app.page.locator("#open-thread").click();
    const childTranslation = app.page.locator('[data-is-detailed-thread-view="true"] [data-tc-translation]');
    await waitFor(childTranslation);
    await app.page.screenshot({ path: path.join(outputDir, "03-child-thread.png"), fullPage: true });

    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-menu]").click();
    await message.locator("[data-tc-menu-item]").click();
    await waitFor(app.page.locator("[data-tc-summary-card]"));
    await app.page.screenshot({ path: path.join(outputDir, "04-summary-card.png"), fullPage: true });

    const worker = app.context.serviceWorkers()[0];
    const extensionId = new URL(worker.url()).hostname;
    const settings = await app.context.newPage();
    await settings.setViewportSize({ width: 900, height: 1100 });
    await settings.goto("chrome-extension://" + extensionId + "/src/options/options.html");
    await waitFor(settings.locator("#baseUrl"));
    await settings.screenshot({ path: path.join(outputDir, "01-settings.png"), fullPage: true });
    await settings.close();
    await app.close();
    app = null;
  } finally {
    if (app) await app.close();
  }

  app = await launchConfiguredApp();
  try {
    await app.page.setViewportSize({ width: 1280, height: 900 });
    app.provider.failNext("auth");
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-tc-action]").click();
    await waitFor(message.locator("[data-tc-error]"));
    await app.page.screenshot({ path: path.join(outputDir, "05-provider-error.png"), fullPage: true });
  } finally {
    await app.close();
  }
}

capture().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
