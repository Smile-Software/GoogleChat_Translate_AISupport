import { test, expect } from "playwright/test";
import { launchConfiguredApp } from "./helpers.js";

test("disabled rooms do not receive translation UI", async () => {
  const app = await launchConfiguredApp({ roomEnabled: false });
  try {
    await expect(app.page.locator("[data-message-id='m-1'] [data-tc-action]")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("authentication failure keeps the original message and shows a safe error", async () => {
  const app = await launchConfiguredApp();
  try {
    app.provider.failNext("auth");
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-error]")).toContainText("authentication");
    await expect(message).toHaveAttribute("data-text", /午後/);
    expect(app.provider.requests.filter((request) => request.url === "/v1/chat/completions")).toHaveLength(1);
  } finally {
    await app.close();
  }
});

test("retrying a transient provider failure succeeds exactly once", async () => {
  const app = await launchConfiguredApp();
  try {
    app.provider.failNext("server");
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-error]")).toContainText("server error");
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-translation]")).toContainText("Chiều nay sẽ nhờ Toyota");
    expect(app.provider.requests.filter((request) => request.url === "/v1/chat/completions")).toHaveLength(2);
  } finally {
    await app.close();
  }
});

test("rate-limit failure is retryable without an automatic loop", async () => {
  const app = await launchConfiguredApp();
  try {
    app.provider.failNext("rate-limit");
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-error]")).toContainText("rate limit");
    expect(app.provider.requests.filter((request) => request.url === "/v1/chat/completions")).toHaveLength(1);
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-translation]")).toContainText("Chiều nay sẽ nhờ Toyota");
    expect(app.provider.requests.filter((request) => request.url === "/v1/chat/completions")).toHaveLength(2);
  } finally {
    await app.close();
  }
});

test("timeout failure returns a retryable timeout state", async () => {
  const app = await launchConfiguredApp({ requestTimeoutMs: 1000 });
  try {
    app.provider.failNext("timeout");
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-error]")).toContainText("timed out");
    expect(app.provider.requests.filter((request) => request.url === "/v1/chat/completions")).toHaveLength(1);
  } finally {
    await app.close();
  }
});

test("malformed and empty provider responses do not render raw response data", async () => {
  for (const scenario of ["malformed-json", "missing-content"]) {
    const app = await launchConfiguredApp();
    try {
      app.provider.failNext(scenario);
      const message = app.page.locator("[data-message-id='m-1']");
      await message.locator("[data-tc-action]").click();
      await expect(message.locator("[data-tc-error]")).toContainText(/invalid|no usable content/);
      expect(await message.locator("script, img, iframe").count()).toBe(0);
    } finally {
      await app.close();
    }
  }
});

test("summary refresh failure preserves the previous private summary", async () => {
  const app = await launchConfiguredApp();
  try {
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-menu]").click();
    await message.locator("[data-tc-menu-item]").click();
    const card = app.page.locator("[data-tc-summary-card]");
    await expect(card).toContainText("Tóm tắt:");
    app.provider.failNext("server");
    await app.page.locator("#add-reply").click();
    await expect(card.locator("[data-tc-stale]")).toBeVisible();
    await card.locator("[data-tc-primary]").click();
    await expect(card).toContainText("Tóm tắt:");
    await expect(card.locator("[data-tc-summary-error]")).toContainText("server error");
  } finally {
    await app.close();
  }
});

test("provider text is rendered as text, never as HTML", async () => {
  const app = await launchConfiguredApp();
  try {
    app.provider.failNext("xss");
    const message = app.page.locator("[data-message-id='m-1']");
    await message.locator("[data-tc-action]").click();
    await expect(message.locator("[data-tc-translation]")).toContainText("<img");
    expect(await message.locator("[data-tc-translation] img").count()).toBe(0);
  } finally {
    await app.close();
  }
});
