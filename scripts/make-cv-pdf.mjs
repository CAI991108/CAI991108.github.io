#!/usr/bin/env node
/**
 * Print files/cv.pdf from the deployed /cv/ page, using the stylesheet in this
 * checkout.
 *
 *     npm run cv:pdf
 *
 * Why this exists: the PDF can only be printed from a rendered page, and the
 * page only renders once it is deployed — while the preflight refuses to let
 * you *keep* deploying with a stale PDF. The way through is two steps, in this
 * order:
 *
 *   1. commit and push the cv.md change (preflight allows one commit of lag)
 *   2. run this, then commit files/cv.pdf
 *
 * The stylesheet is compiled locally so print rules that are not deployed yet
 * still apply; everything else comes from the live page.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT, buildPage, findChrome } from "./lib/preview.mjs";

const pdf = join(ROOT, "files", "cv.pdf");

function git(args) {
  return spawnSync(`git ${args}`, { cwd: ROOT, shell: true, encoding: "utf8" });
}

// The page has to be deployed first: this prints what is live, not what is in
// the working tree.
const dirty = git("status --porcelain -- _pages/cv.md");
if ((dirty.stdout || "").trim()) {
  console.warn("! _pages/cv.md has uncommitted changes — push them and let Pages build before printing,");
  console.warn("  otherwise the PDF will not match the page. Printing the deployed version anyway.\n");
}

try {
  const html = await buildPage("/cv/");
  const dir = mkdtempSync(join(tmpdir(), "cv-pdf-"));
  const source = join(dir, "cv.html");
  writeFileSync(source, html);

  const run = spawnSync(
    findChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--user-data-dir=${join(dir, "profile")}`,
      "--virtual-time-budget=15000",
      `--print-to-pdf=${pdf}`,
      `file:///${source.replace(/\\/g, "/")}`,
    ],
    { stdio: "ignore" },
  );
  if (run.status !== 0) throw new Error("chrome exited non-zero");

  const kb = (statSync(pdf).size / 1024).toFixed(0);
  console.log(`files/cv.pdf  ${kb} KB`);
  console.log("commit it, then run: npm run preflight");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
