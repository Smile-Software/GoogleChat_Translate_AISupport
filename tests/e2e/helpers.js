import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startProviderServer } from "../fixtures/provider-server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function startFixtureServer() {
  const html = await fs.readFile(path.join(root, "tests/fixtures/google-chat.html"), "utf8");
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    resolve({
      url: "http://localhost:" + address.port + "/",
      close: () => new Promise((done) => server.close(done))
    });
  }));
}

export async function launchConfiguredApp({ autoTranslate = false, requestTimeoutMs = 20000, roomEnabled = true } = {}) {
  const fixture = await startFixtureServer();
  const provider = await startProviderServer();
  const extensionPath = root;
  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--disable-extensions-except=" + extensionPath,
      "--load-extension=" + extensionPath
    ]
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).hostname;
  const options = await context.newPage();
  await options.goto("chrome-extension://" + extensionId + "/src/options/options.html");
  await options.locator("#baseUrl").fill(provider.baseUrl.replace("127.0.0.1", "localhost"));
  await options.locator("#apiKey").fill("TEST_KEY");
  await options.locator("#model").fill("luna-fast");
  await options.locator("#timeout").fill(String(requestTimeoutMs));
  await options.locator("#autoTranslate").setChecked(autoTranslate);
  await options.locator("#save").click();
  await options.getByText("Đã lưu").waitFor();
  if (roomEnabled) {
    await options.evaluate(async () => {
      const current = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
      await chrome.runtime.sendMessage({
        type: "SAVE_SETTINGS",
        settings: {
          ...current.settings,
          roomAllowlist: {
            ...current.settings.roomAllowlist,
            "fixture-room": { label: "Fixture room", enabledAt: Date.now() }
          }
        }
      });
    });
  }
  const page = await context.newPage();
  await page.goto(fixture.url);
  return {
    context,
    page,
    provider,
    fixture,
    close: async () => {
      await context.close();
      await provider.close();
      await fixture.close();
    }
  };
}
