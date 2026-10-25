// Shared by scripts/preview.mjs and scripts/make-cv-pdf.mjs: render a page
// with the *current* stylesheet without deploying it.
//
// The trick is small but it saves a full deploy cycle: fetch the live page
// (real chrome, sidebar, footer), swap its stylesheet for the locally compiled
// one, and optionally swap the page body for markup that is not deployed yet.
// Font URLs are rewritten to absolute because the inline <style> no longer
// lives next to /assets/fonts.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const BASE = (process.env.SITE_URL || "https://cai991108.github.io").replace(/\/$/, "");

export function compiledCss() {
  const scss = readFileSync(join(ROOT, "assets", "css", "main.scss"), "utf8");
  const body = scss.replace(/^---\r?\n---\r?\n/, ""); // Jekyll strips front matter; sass cannot parse it

  const dir = mkdtempSync(join(tmpdir(), "site-css-"));
  const input = join(dir, "main.scss");
  const output = join(dir, "main.css");
  writeFileSync(input, body);

  const run = spawnSync(
    `npx -y sass@1.77.8 --no-source-map --quiet --style=compressed --load-path="${join(ROOT, "_sass")}" "${input}" "${output}"`,
    { shell: true, encoding: "utf8", cwd: ROOT },
  );
  if (run.status !== 0) {
    throw new Error(`sass failed: ${(run.stderr || "").trim().split(/\r?\n/).slice(0, 3).join(" | ")}`);
  }
  return readFileSync(output, "utf8");
}

export async function buildPage(path, { content } = {}) {
  const css = compiledCss().replace(/url\((["']?)\.\.\/fonts\//g, `url($1${BASE}/assets/fonts/`);

  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);

  let html = await res.text();
  html = html.replace("<head>", `<head>\n<base href="${BASE}">`);
  html = html.replace(/<link rel="stylesheet" href="[^"]*main\.css">/, `<style>${css}</style>`);

  if (content) {
    const swapped = html.replace(
      /(<section class="page__content"[^>]*>)[\s\S]*?(<\/section>)/,
      (_m, open, close) => `${open}\n${content}\n${close}`,
    );
    if (swapped === html) throw new Error("--content found no .page__content to replace on that page");
    html = swapped;
  }

  return html;
}

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`no chrome found; set CHROME_PATH (looked at: ${candidates.join(", ")})`);
  return found;
}
