#!/usr/bin/env node
/**
 * Render a page with the current stylesheet, locally, without deploying.
 *
 *     node scripts/preview.mjs / out.html
 *     node scripts/preview.mjs / out.html --content new-body.html
 *
 * The page's shell (sidebar, masthead, footer) comes from the live site; the
 * CSS is compiled from this checkout; `--content` replaces the page body for
 * markup that has not been deployed yet. Then shoot it:
 *
 *     node scripts/shoot.mjs "file:///.../out.html" out.png --width 1440
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { ROOT, buildPage } from "./lib/preview.mjs";

const args = process.argv.slice(2);
const ci = args.indexOf("--content");
const contentFile = ci > -1 ? args.splice(ci, 2)[1] : null;
const [path, out] = args;

if (!path || !out) {
  console.error("usage: node scripts/preview.mjs <path> <out.html> [--content <file.html>]");
  process.exit(1);
}

const content = contentFile ? readFileSync(resolve(contentFile), "utf8") : null;

try {
  const html = await buildPage(path, { content });
  const target = resolve(out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);

  const rel = relative(ROOT, target).replace(/\\/g, "/");
  console.log(`${rel}  ${(html.length / 1024).toFixed(0)} KB`);
  console.log(`shoot: node scripts/shoot.mjs "file:///${target.replace(/\\/g, "/")}" out.png --width 1440`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
