#!/usr/bin/env node
/**
 * Assertions about the *live* site.
 *
 * There is no local Jekyll on this machine, so every change is verified after
 * the Pages build. This script is that verification, so it stays cheap to run:
 *
 *     node scripts/check-site.mjs
 *     SITE_URL=http://127.0.0.1:4000 node scripts/check-site.mjs   # against a local serve
 *
 * It checks, for every URL in PAGES:
 *   1. the page returns 200
 *   2. every same-origin sub-resource it references returns 200 (catches the
 *      "15 broken favicon links on every page" class of bug)
 *   3. at a 390px viewport the document does not scroll sideways
 * and, page by page:
 *   4. /cv/ carries none of the known-wrong strings
 *   5. the homepage head is sane (lang, og:locale, avatar)
 *
 * Exit code 1 on any failure. Chrome is only needed for check 3; if it is not
 * found that check is skipped with a warning rather than failing the run.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.SITE_URL || "https://cai991108.github.io").replace(/\/$/, "");
const PAGES = ["/", "/cv/", "/research/", "/projects/"];
const MOBILE_WIDTH = 390;

// Scoped to the CV on purpose: "quantization" is a real term elsewhere on the
// site, but in the fund-management bullets it should read "quantitative".
const CV_TYPOS = /Economictrics|Advance Mathematics|the STATA|portofolio|quantization/i;

// Copy the template left behind. Any of it on a live page means a page is a
// stub, and the nav should not be pointing at it.
const PLACEHOLDER = /I have nothing published yet|Nothing's here yet|Maybe some place in future|Name Name|Your Name/i;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

/** Same-origin URLs referenced by a page, as absolute paths. */
function subResources(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    let u = m[1].replace(/&amp;/g, "&");
    if (/^(mailto:|tel:|#|javascript:|data:)/i.test(u)) continue;
    if (u.startsWith("//")) continue;
    if (/^https?:\/\//i.test(u)) {
      if (!u.toLowerCase().startsWith(BASE.toLowerCase())) continue;
      u = u.slice(BASE.length) || "/";
    }
    if (!u.startsWith("/")) continue;
    urls.add(u);
  }
  return [...urls];
}

async function checkPage(path) {
  const url = BASE + path;
  const res = await fetch(url, { redirect: "manual" });
  const html = await res.text();
  record(`GET ${path}`, res.status === 200, `${res.status}`);

  const broken = [];
  for (const sub of subResources(html)) {
    const r = await fetch(BASE + sub, { method: "GET", redirect: "manual" });
    if (r.status >= 400) broken.push(`${r.status} ${sub}`);
  }
  record(`${path} sub-resources`, broken.length === 0, broken.slice(0, 8).join(", "));

  const stub = html.match(PLACEHOLDER);
  record(`${path} not a stub`, !stub, stub ? `found "${stub[0]}"` : "");

  return { html, status: res.status };
}

// ---------------------------------------------------------------- overflow --

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  return null;
}

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
  once(method, timeoutMs = 20000) {
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
      /* chrome not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("chrome devtools endpoint never came up");
}

async function measureOverflow(chromePath, path) {
  const userDataDir = mkdtempSync(join(tmpdir(), "site-check-"));
  const port = 9400 + Math.floor(Math.random() * 300);
  const proc = spawn(
    chromePath,
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
      ws.onerror = (e) => reject(new Error(`websocket failed: ${e.message ?? "error"}`));
    });
    const cdp = new Cdp(ws);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: MOBILE_WIDTH,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: BASE + path });
    await loaded;

    const { result } = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const doc = document.documentElement;
        const vw = window.innerWidth;
        const wide = [...document.querySelectorAll('body *')]
          .map(el => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.right > vw + 1)
          .slice(0, 5)
          .map(({ el, r }) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\\s+/).join('.') : '') + ' right=' + Math.round(r.right));
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, viewport: vw, offenders: wide };
      })()`,
    });

    ws.close();
    return result.value;
  } finally {
    proc.kill();
    setTimeout(() => rmSync(userDataDir, { recursive: true, force: true }), 500);
  }
}

// -------------------------------------------------------------------- main --

const chrome = findChrome();

for (const path of PAGES) {
  try {
    const { html } = await checkPage(path);

    if (path === "/cv/") {
      const bad = html.match(CV_TYPOS);
      record("cv typos", !bad, bad ? `found "${bad[0]}"` : "none");
      const emptySection = /<h[12][^>]*>\s*(Publications|Talks|Teaching)/i.test(html);
      record("cv has no empty sections", !emptySection, emptySection ? "empty section heading present" : "none");
    }

    if (path === "/") {
      const lang = html.match(/<html[^>]*lang="([^"]*)"/);
      record("home lang", lang?.[1] === "en", lang ? `lang="${lang[1]}"` : "missing");
      const ogLocale = html.match(/property="og:locale" content="([^"]*)"/);
      record("home og:locale", ogLocale?.[1] === "en_US", ogLocale ? `"${ogLocale[1]}"` : "missing");
      record("home avatar is webp", /profile\.webp/.test(html) && !/profile\.png/.test(html), "");
      record(
        "home has no visitor counter",
        !/komarev\.com/.test(html),
        /komarev\.com/.test(html) ? "komarev still embedded" : "none",
      );
    }

    if (path === "/research/") {
      record(
        "research names both lab systems",
        /CrossLedger/.test(html) && /CrossBooks/.test(html),
        /CrossLedger/.test(html) && /CrossBooks/.test(html) ? "" : "CrossLedger / CrossBooks missing",
      );
    }

    if (path === "/projects/") {
      const cards = (html.match(/class="project-card"/g) || []).length;
      record("projects renders cards", cards >= 7, `${cards} cards`);
    }
  } catch (err) {
    record(`GET ${path}`, false, err.message);
  }
}

// Pages the template shipped that this site has deliberately dropped. If one
// comes back, something re-added a stub to the nav.
for (const path of [
  "/publications/",
  "/talks/",
  "/teaching/",
  "/portfolio/",
  "/year-archive/",
  "/markdown/",
  "/terms/",
]) {
  try {
    const r = await fetch(BASE + path, { redirect: "manual" });
    record(`${path} stays gone`, r.status === 404, `${r.status}`);
  } catch (err) {
    record(`${path} stays gone`, false, err.message);
  }
}

if (chrome) {
  for (const path of PAGES) {
    try {
      const m = await measureOverflow(chrome, path);
      const ok = m.scrollWidth <= m.clientWidth + 1;
      record(
        `${path} fits ${MOBILE_WIDTH}px`,
        ok,
        ok
          ? `${m.scrollWidth}px content / ${m.clientWidth}px viewport`
          : `overflows to ${m.scrollWidth}px: ${m.offenders.join(" | ")}`,
      );
    } catch (err) {
      record(`${path} fits ${MOBILE_WIDTH}px`, false, err.message);
    }
  }
} else {
  record(`overview check`, true, "skipped: no chrome found (set CHROME_PATH)");
}

// Homepage weight of same-origin <link>/<img> resources, decoded bytes.
try {
  const html = await (await fetch(BASE + "/")).text();
  let bytes = Buffer.byteLength(html);
  for (const sub of subResources(html)) {
    if (/\.(css|png|webp|jpe?g|svg|ico|json)$/i.test(sub)) {
      const r = await fetch(BASE + sub);
      bytes += Buffer.from(await r.arrayBuffer()).length;
    }
  }
  const kb = bytes / 1024;
  record("home weight (<400KB)", kb < 400, `${kb.toFixed(0)}KB`);
} catch (err) {
  record("home weight", false, err.message);
}

// ------------------------------------------------------------------ report --

let failed = 0;
for (const { name, ok, detail } of results) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed on ${BASE}`);
process.exit(failed ? 1 : 0);
