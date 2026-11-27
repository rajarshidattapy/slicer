import { execFile, spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEVTOOLS_CLI = path.join(
  PROJECT_ROOT,
  "node_modules",
  "chrome-devtools-mcp",
  "out",
  "Default",
  "gen",
  "src",
  "bin",
  "chrome-devtools.js",
);

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

export async function findBrowserExecutable() {
  if (process.env.SWIGGY_CHROME_PATH) {
    if (!(await exists(process.env.SWIGGY_CHROME_PATH))) {
      throw new Error(
        `SWIGGY_CHROME_PATH does not point to an executable: ${process.env.SWIGGY_CHROME_PATH}`,
      );
    }
    return process.env.SWIGGY_CHROME_PATH;
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
  throw new Error(
    "Google Chrome was not found. Set SWIGGY_CHROME_PATH to its executable.",
  );
}

export async function openDefaultChrome(url) {
  const executablePath = await findBrowserExecutable();
  const child = spawn(executablePath, [url], {
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

function chromeLocalStatePath() {
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA ?? "",
      "Google",
      "Chrome",
      "User Data",
      "Local State",
    );
  }
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "Local State",
    );
  }
  return path.join(os.homedir(), ".config", "google-chrome", "Local State");
}

export async function defaultChromeRemoteDebuggingEnabled() {
  try {
    const state = JSON.parse(await readFile(chromeLocalStatePath(), "utf8"));
    return state.devtools?.remote_debugging?.["user-enabled"] === true;
  } catch {
    return null;
  }
}

async function runDevtools(args, timeout = 60_000) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [DEVTOOLS_CLI, ...args], {
      cwd: PROJECT_ROOT,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
      },
    });
    return stdout.trim();
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(detail || "Chrome DevTools command failed.");
  }
}

export async function ensureDefaultChromeConnection() {
  const status = await runDevtools(["status"], 10_000);
  if (/is running/i.test(status) && !/not running/i.test(status)) return;

  await runDevtools(
    [
      "start",
      "--autoConnect=true",
      "--headless=false",
      "--usageStatistics=false",
      "--allowedUrlPattern=https://www.swiggy.com/*",
      "--allowedUrlPattern=https://media-assets.swiggy.com/*",
    ],
    30_000,
  );
}

export async function newSwiggyPage(pathname = "/") {
  await ensureDefaultChromeConnection();
  const url = pathname.startsWith("http")
    ? pathname
    : `https://www.swiggy.com${pathname}`;
  if (!url.startsWith("https://www.swiggy.com/")) {
    throw new Error("Only https://www.swiggy.com/ URLs are allowed.");
  }
  const output = await runDevtools(["new_page", url, "--output-format=json"], 90_000);
  const result = JSON.parse(output);
  if (Array.isArray(result)) {
    const message = result
      .filter((entry) => entry?.type === "text")
      .map((entry) => entry.text)
      .join("\n");
    throw new Error(message || "Chrome DevTools could not open the page.");
  }
  const selected = result.pages?.find((page) => page.selected) ?? result.pages?.at(-1);
  if (!selected?.id) throw new Error("Chrome opened the page but returned no page ID.");
  return selected.id;
}

export async function evaluateInPage(pageId, functionSource, timeout = 60_000) {
  const output = await runDevtools(
    [
      "evaluate_script",
      functionSource,
      "--pageId",
      String(pageId),
      "--output-format=json",
    ],
    timeout,
  );
  const envelope = JSON.parse(output);
  if (Array.isArray(envelope)) {
    const message = envelope
      .filter((entry) => entry?.type === "text")
      .map((entry) => entry.text)
      .join("\n");
    throw new Error(message || "Chrome DevTools could not evaluate the page.");
  }
  const match = /```json\s*([\s\S]*?)\s*```/.exec(envelope.message ?? "");
  if (!match) throw new Error(envelope.message ?? "Chrome returned no JSON result.");
  return JSON.parse(match[1]);
}

export async function verifyDefaultChromeConnection() {
  const pageId = await newSwiggyPage("/");
  return evaluateInPage(pageId, "() => ({ title: document.title, url: location.href })");
}

export async function waitForEnter(message = "Press Enter to continue...") {
  if (!process.stdin.isTTY) return;
  process.stdout.write(`${message}\n`);
  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once("data", resolve));
  process.stdin.pause();
}
