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

/** WCAG relative luminance for a #rgb / #rrggbb string. */
function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** True when some rule inside the print block hides `selector`. The compiled
 *  CSS groups hidden selectors, so the selector list has to be inspected. */
function hidesInPrint(printBlock, selector) {
  for (const m of printBlock.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].includes(selector) && /display\s*:\s*none/.test(m[2])) return true;
  }
  return false;
}
function mediaBlock(css, query) {
  const start = css.indexOf(`@media ${query}{`);
  if (start === -1) return "";
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  return "";
}

/** Every balanced @media block for `query`: the theme ships one print block and
 *  the site's overrides add a second, so the first match is not enough. */
function mediaBlocks(css, query) {
  const blocks = [];
  let from = 0;
  for (;;) {
    const block = mediaBlock(css.slice(from), query);
    if (!block) return blocks;
    const start = css.indexOf(block, from);
    const end = start + block.length;
    blocks.push(block);
    from = end;
  }
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

  const desc = html.match(/<meta name="description" content="([^"]*)"/);
  record(
    `${path} has a description`,
    !!desc && desc[1].trim().length > 20,
    desc ? desc[1].slice(0, 58) + "…" : "missing",
  );

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

async function measure(chromePath, path, { width, height = 900, dsf = 1, mobile = false } = {}) {
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
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dsf, mobile });

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
        const content = document.querySelector('.page__content') || document.querySelector('.archive');
        let charsPerLine = null;
        if (content) {
          const para = [...content.querySelectorAll('p')].find(p => (p.textContent || '').trim().length > 120);
          if (para) {
            const range = document.createRange();
            range.selectNodeContents(para);
            const lines = [...range.getClientRects()].filter(r => r.width > 50).length;
            if (lines > 0) charsPerLine = Math.round(para.textContent.trim().length / lines);
          }
        }
        const contentBottom = content ? Math.round(content.getBoundingClientRect().bottom + window.scrollY) : null;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, viewport: vw, offenders: wide, charsPerLine, contentBottom };
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
      // Absolute same-origin URLs (the template's base_path makes the avatar
      // one) are not third-party; compare against the host, not the prefix.
      const thirdPartyImages = [...html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)]
        .map((m) => m[1])
        .filter((u) => !u.toLowerCase().startsWith(BASE.toLowerCase()));
      record(
        "home loads no third-party images",
        thirdPartyImages.length === 0,
        thirdPartyImages.slice(0, 4).join(", "),
      );
      const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
      record("home h1 is the name", /Zijin CAI/.test(h1) && /蔡子晋/.test(h1), h1.replace(/<[^>]+>/g, "").trim());
      record("home drops the greeting", !/Hi there, this is/i.test(html), /Hi there, this is/i.test(html) ? "greeting still there" : "");
      const workRows = (html.match(/class="work-item"/g) || []).length;
      record("home shows two pieces of work", workRows === 2, `${workRows} rows`);
      record(
        "home has no cards or chips",
        !/class="project-card"|class="chip"/.test(html),
        /class="project-card"|class="chip"/.test(html) ? "card chrome still present" : "",
      );

      const ogImage = (html.match(/property="og:image" content="([^"]+)"/) || [])[1];
      record("home has og:image", /og-card\.png/.test(ogImage || ""), ogImage || "missing");
      record("home has a twitter card", /name="twitter:card" content="summary_large_image"/.test(html), "");
      if (ogImage) {
        const img = await fetch(new URL(ogImage, BASE));
        record(
          "og:image resolves",
          img.status === 200 && /image\//.test(img.headers.get("content-type") || ""),
          `${img.status} ${img.headers.get("content-type")}`,
        );
      }
    }

    if (path === "/cv/") {
      const rows = (html.match(/class="cv-row"/g) || []).length;
      record("cv entries are laid out as rows", rows >= 8, `${rows} rows`);
    }

    if (path === "/research/") {
      record(
        "research names both lab systems",
        /CrossLedger/.test(html) && /CrossBooks/.test(html),
        /CrossLedger/.test(html) && /CrossBooks/.test(html) ? "" : "CrossLedger / CrossBooks missing",
      );
    }

    if (path === "/projects/") {
      const rows = (html.match(/class="work-item"/g) || []).length;
      record("projects renders every repository", rows >= 7, `${rows} rows`);
      record(
        "projects has no card chrome",
        !/class="project-card"|class="chip"/.test(html),
        /class="project-card"|class="chip"/.test(html) ? "card chrome still present" : "",
      );
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
      const m = await measure(chrome, path, { width: MOBILE_WIDTH, height: 844, dsf: 2, mobile: true });
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

  // The reading measure and the homepage length are the two numbers this
  // redesign was argued from, so they are measured on the real page at the
  // width the argument was made at.
  try {
    const d = await measure(chrome, "/", { width: 1440, height: 900 });
    record(
      "home measure is 60-72 characters",
      d.charsPerLine >= 60 && d.charsPerLine <= 72,
      `${d.charsPerLine} chars/line`,
    );
    record("home content ends within 1500px", d.contentBottom <= 1500, `${d.contentBottom}px`);
  } catch (err) {
    record("home measure is 60-72 characters", false, err.message);
  }
} else {
  record(`overview check`, true, "skipped: no chrome found (set CHROME_PATH)");
}

// The palette and font stack have to survive the Sass build and reach the CSS.
try {
  const css = await (await fetch(BASE + "/assets/css/main.css")).text();
  const hasLink = /#4f6d99/i.test(css);
  record("css carries the link colour", hasLink, hasLink ? "#4f6d99" : "#4f6d99 missing from main.css");
  const hasCjk = /Noto Sans SC/.test(css);
  record("css carries the CJK stack", hasCjk, hasCjk ? "Noto Sans SC" : "Noto Sans SC missing from main.css");
  const hasFace = /Source Serif 4/.test(css);
  record("css references the text face", hasFace, hasFace ? "Source Serif 4" : "Source Serif 4 missing");

  // Paper is a CV, not a portfolio: the certificates are on screen only.
  const prints = mediaBlocks(css, "print");
  const hidesCerts = prints.some((block) => hidesInPrint(block, ".cert-grid"));
  record(
    "print hides the certificates",
    hidesCerts,
    prints.length === 0 ? "no @media print block" : hidesCerts ? "" : ".cert-grid is not hidden in any print block",
  );

  // The link colour is the one place the palette meets a readability floor.
  const link = (css.match(/(?:^|[},])a\{color:(#[0-9a-f]{3,6})\}/i) || [])[1];
  const ratio = link ? contrastRatio(link, "#ffffff") : 0;
  record("link colour passes AA", ratio >= 4.5, link ? `${link} on white = ${ratio.toFixed(2)}:1` : "link colour not found");
} catch (err) {
  record("css carries the link colour", false, err.message);
}

// The text face is served by the site, not by a font CDN.
try {
  const res = await fetch(BASE + "/assets/fonts/source-serif-4-400.woff2");
  const type = res.headers.get("content-type") || "";
  record("serif is self-hosted", res.status === 200 && /font\/woff2/.test(type), `${res.status} ${type}`);
} catch (err) {
  record("serif is self-hosted", false, err.message);
}

// The Person entity has to be parseable JSON with a real sameAs list.
try {
  const html = await (await fetch(BASE + "/")).text();
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let ok = false;
  let detail = "no ld+json block";
  if (block) {
    try {
      const data = JSON.parse(block[1]);
      const sameAs = Array.isArray(data.sameAs) ? data.sameAs : [];
      const hasNull = /\bnull\b/.test(block[1]);
      ok = data["@type"] === "Person" && sameAs.length >= 3 && !hasNull;
      detail = `@type=${data["@type"]} sameAs=${sameAs.length}${hasNull ? " contains null" : ""}`;
    } catch (err) {
      detail = `invalid JSON: ${err.message}`;
    }
  }
  record("person schema is valid", ok, detail);
} catch (err) {
  record("person schema is valid", false, err.message);
}

// The CV PDF is printed from /cv/ and linked from the sidebar, so it has to be
// reachable at the path the sidebar points at.
try {
  const r = await fetch(BASE + "/files/cv.pdf");
  const type = r.headers.get("content-type") || "";
  record("cv pdf is published", r.status === 200 && /pdf/i.test(type), `${r.status} ${type}`);
} catch (err) {
  record("cv pdf is published", false, err.message);
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

// ------------------------------------------------------------------ i18n --

/* The Chinese pages are a second copy of the same site, which is the shape that
 * rots: someone edits one side and forgets the other, drops a hreflang link, or
 * ships a "Chinese" page that is still English.
 *
 * Wording is deliberately not compared. The Chinese pages are rewrites, not
 * translations, so what is asserted is the structure (both sides exist, they
 * point at each other, each declares its own language), that the Chinese is
 * really Chinese, and that the facts that must never drift are still there. */

const LANG_PAIRS = [
  ["/", "/zh/"],
  ["/research/", "/zh/research/"],
];

try {
  const cache = new Map();
  const get = async (p) => {
    if (!cache.has(p)) {
      const res = await fetch(BASE + p);
      cache.set(p, { status: res.status, html: res.ok ? await res.text() : "" });
    }
    return cache.get(p);
  };
  const alternates = (html) => {
    const out = {};
    for (const m of html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)">/g)) out[m[1]] = m[2];
    return out;
  };

  // 1. both directions answer, and each side names the other. Adding a page
  //    without wiring its pair fails here rather than six months later.
  let pairsOk = true;
  const pairNotes = [];
  for (const [en, zh] of LANG_PAIRS) {
    const a = await get(en);
    const b = await get(zh);
    const ok =
      a.status === 200 && b.status === 200 && Boolean(alternates(a.html)["zh-Hans"]) && Boolean(alternates(b.html)["en"]);
    if (!ok) {
      pairsOk = false;
      pairNotes.push(en + "/" + zh + " " + a.status + "/" + b.status);
    }
  }
  record("every language pair answers both ways", pairsOk, pairsOk ? LANG_PAIRS.length + " pairs" : pairNotes.join(", "));

  // 2. hreflang is self-inclusive, reciprocal, and x-default lands on English —
  //    Google drops a one-way set entirely, so a half-wired pair is invisible.
  //    Compared by pathname, not by full URL: the check also runs against a
  //    local serve (SITE_URL), where the page's own absolute_url still names
  //    production and the origin would be a false mismatch.
  const pathOf = (u) => {
    try {
      return new URL(u).pathname;
    } catch {
      return null;
    }
  };
  let hrefOk = true;
  const hrefNotes = [];
  for (const [en, zh] of LANG_PAIRS) {
    const expected = { en, "zh-Hans": zh, "x-default": en };
    const matches = (m) =>
      pathOf(m.en) === expected.en && pathOf(m["zh-Hans"]) === expected["zh-Hans"] && pathOf(m["x-default"]) === expected.en;
    const a = alternates((await get(en)).html);
    const b = alternates((await get(zh)).html);
    if (!matches(a) || !matches(b)) {
      hrefOk = false;
      hrefNotes.push(en + " " + JSON.stringify(a));
    }
  }
  record("hreflang is reciprocal, x-default on English", hrefOk, hrefOk ? LANG_PAIRS.length + " pairs" : hrefNotes[0]);

  // 3. the document language is per page, not per site. zh-Hans, not zh: the
  //    layout used to slice the locale to two letters, which turns zh-Hans into
  //    zh and would quietly make this pass.
  const LANGS = [
    ["/", "en"],
    ["/cv/", "en"],
    ["/research/", "en"],
    ["/projects/", "en"],
    ["/zh/", "zh-Hans"],
    ["/zh/research/", "zh-Hans"],
  ];
  let langOk = true;
  const langNotes = [];
  for (const [p, want] of LANGS) {
    const got = ((await get(p)).html.match(/<html[^>]*lang="([^"]*)"/) || [])[1];
    if (got !== want) {
      langOk = false;
      langNotes.push(p + '="' + got + '"');
    }
  }
  record("<html lang> is right on every page", langOk, langOk ? LANGS.length + " pages" : langNotes.join(", "));

  // 4. the Chinese pages are in Chinese. Measured 2026-10: /zh/ 0.40 Han per
  //    letter, /zh/research/ 0.72; every English page sits at 0.01. The floor is
  //    far below the live values on purpose — it catches a page that reverted to
  //    English, not a page that quotes one.
  let hanOk = true;
  const hanNotes = [];
  for (const [, zh] of LANG_PAIRS) {
    const text = (await get(zh)).html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    const han = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    const ratio = han / (han + latin || 1);
    if (han < 200 || ratio < 0.3) {
      hanOk = false;
      hanNotes.push(zh + " han=" + han + " ratio=" + ratio.toFixed(2));
    }
  }
  record("Chinese pages are actually in Chinese", hanOk, hanOk ? "han>=200, ratio>=0.30" : hanNotes.join(", "));

  // 5. the facts that must not drift. Not sentences: the address, the two
  //    institutions, and the lab systems both pages name.
  const ANCHORS = ["zijincai@link.cuhk.edu.cn", "CUHK", "CROSS", "CrossLedger", "CrossBooks"];
  let factsOk = true;
  const factNotes = [];
  for (const [, zh] of LANG_PAIRS) {
    const html = (await get(zh)).html;
    const missing = ANCHORS.filter((a) => !html.includes(a));
    if (missing.length) {
      factsOk = false;
      factNotes.push(zh + " missing " + missing.join("/"));
    }
  }
  record("Chinese pages keep the facts", factsOk, factsOk ? ANCHORS.length + " anchors" : factNotes.join(", "));

  // 6. the Chinese face is a subset, and only Chinese pages ask for it. A full
  //    Noto Serif SC is 15.7 MB; one accidentally committed would still render.
  let fontOk = true;
  const fontNotes = [];
  for (const w of [400, 600]) {
    const res = await fetch(BASE + "/assets/fonts/noto-serif-sc-" + w + ".woff2");
    const bytes = res.ok ? (await res.arrayBuffer()).byteLength : 0;
    if (res.status !== 200 || bytes === 0 || bytes > 200 * 1024) {
      fontOk = false;
      fontNotes.push(w + " " + res.status + " " + bytes + "B");
    }
  }
  record("Chinese face is a subset under 200 KB", fontOk, fontOk ? "400 + 600" : fontNotes.join(", "));

  const enHtml = (await get("/")).html;
  const zhHtml = (await get("/zh/")).html;
  const onlyZh = !/@font-face/.test(enHtml) && (zhHtml.match(/@font-face/g) || []).length >= 2;
  record("Chinese face loads only on Chinese pages", onlyZh, onlyZh ? "0 on /, 2 on /zh/" : "font-face leaked");
} catch (err) {
  record("the Chinese pages are guarded", false, err.message);
}

// ------------------------------------------------------------------ report --

let failed = 0;
for (const { name, ok, detail } of results) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed on ${BASE}`);
process.exit(failed ? 1 : 0);
