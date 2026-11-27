import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { chromium } from "playwright-core";

const WINDOWS_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const MAC_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const LINUX_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

async function exists(candidate) {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findChrome() {
  if (process.env.ZOMATO_CHROME_PATH) {
    if (!(await exists(process.env.ZOMATO_CHROME_PATH))) {
      throw new Error(
        `ZOMATO_CHROME_PATH does not point to an executable: ${process.env.ZOMATO_CHROME_PATH}`,
      );
    }
    return process.env.ZOMATO_CHROME_PATH;
  }
  const candidates =
    process.platform === "win32"
      ? WINDOWS_CANDIDATES
      : process.platform === "darwin"
        ? MAC_CANDIDATES
        : LINUX_CANDIDATES;
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error("Google Chrome was not found. Set ZOMATO_CHROME_PATH.");
}

export async function openInDefaultChrome(url) {
  const executable = await findChrome();
  const child = spawn(executable, [url], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
}

export async function withPublicPage(url, action) {
  const executablePath = await findChrome();
  const browser = await chromium.launch({
    executablePath,
    headless: false,
    // Keep Chrome's sandbox. This also avoids the unsafe-flag warning.
    ignoreDefaultArgs: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      locale: "en-IN",
      timezoneId: "Asia/Calcutta",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(4_000);
    return await action(page);
  } finally {
    await browser.close();
  }
}
