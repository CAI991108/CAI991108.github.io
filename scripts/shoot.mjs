#!/usr/bin/env node
/**
 * Screenshot a page the way a browser actually lays it out.
 *
 *     node scripts/shoot.mjs <url> <out.png> [--width 1440] [--mobile] [--max-height 6000]
 *
 * Widths of 500px or less switch on mobile emulation automatically; that is
 * the whole point of this script. Chrome's plain `--screenshot` flag sets a
 * window size without device emulation, so a "390px" capture comes out as a
 * desktop layout cropped to 390 — which is how a healthy page got mistaken for
 * a broken one on this project. Here the layout viewport really is 390.
 *
 * The page is captured at its full height, clamped to --max-height, and the
 * pixel budget is kept under 7000px per side because an image taller than that
 * cannot be opened by the tooling that is supposed to look at it.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// ------------------------------------------------------------------- args --

const argv = process.argv.slice(2);
const positional = [];
let width = 1440;
let mobile = null;
let maxHeight = 6000;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--width") width = Number.parseInt(argv[++i], 10);
  else if (a === "--max-height") maxHeight = Number.parseInt(argv[++i], 10);
  else if (a === "--mobile") mobile = true;
  else if (a === "--desktop") mobile = false;
  else positional.push(a);
}

const [url, out] = positional;
if (!url || !out) die("usage: node scripts/shoot.mjs <url> <out.png> [--width 1440] [--mobile] [--max-height 6000]");
if (mobile === null) mobile = width <= 500;

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) die(`no chrome found; set CHROME_PATH (looked at: ${CHROME_CANDIDATES.join(", ")})`);

// -------------------------------------------------------------------- cdp --

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.events = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method && this.events.has(msg.method)) {
        for (const fn of this.events.get(msg.method)) fn(msg.params);
        this.events.delete(msg.method);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  once(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), timeoutMs);
      this.events.set(method, [
        (params) => {
          clearTimeout(timer);
          resolve(params);
        },
      ]);
    });
  }
}

async function waitForTarget(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("chrome devtools endpoint never came up");
}

async function main() {
  const userDataDir = mkdtempSync(join(tmpdir(), "shoot-"));
  const port = 9500 + Math.floor(Math.random() * 400);
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${port}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const target = await waitForTarget(port);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error("websocket failed"));
    });
    const cdp = new Cdp(ws);

    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile,
    });

    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url });
    await loaded;
    await new Promise((r) => setTimeout(r, 1200)); // let webfonts settle

    const metrics = await cdp.send("Page.getLayoutMetrics");
    const height = Math.min(Math.ceil(metrics.cssContentSize.height), maxHeight);

    // Keep both sides under the 7000px an image reader will accept.
    let dsf = mobile ? 2 : 1;
    if (height * dsf > 7000 || width * dsf > 7000) dsf = 1;

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: dsf,
      mobile,
    });
    await new Promise((r) => setTimeout(r, 500));

    const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(out, Buffer.from(shot.data, "base64"));

    console.log(`${out}  ${width}x${height} css px, ${dsf}x -> ${width * dsf}x${height * dsf} px`);
    ws.close();
  } finally {
    proc.kill();
    setTimeout(() => rmSync(userDataDir, { recursive: true, force: true }), 500);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
