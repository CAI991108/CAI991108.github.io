#!/usr/bin/env node
/**
 * Checks that can run before a push, with no network and no Jekyll.
 *
 * `check-site.mjs` verifies the deployed site; that means every mistake is
 * found 40 seconds after it is irreversible. This is the other half: the
 * failure modes that are cheap to catch on the way out.
 *
 *     npm run preflight
 *
 * Four checks:
 *   1. every content file's front matter is structurally sound
 *   2. every {% include %} names a file that exists in _includes/
 *   3. assets/css/main.scss still compiles
 *   4. the CV PDF is not older than the CV page it was printed from
 *
 * The front-matter check is a structural lint, not a YAML parser: it catches
 * what actually goes wrong here (missing `---`, tab indentation, a key typo
 * that duplicates another, an unclosed block). It deliberately does not try to
 * validate the values.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set([".git", "node_modules", "_site", ".scratch", "vendor", "assets/js/vendor"]);

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
}
function skip(name, why) {
  results.push({ name, ok: true, skipped: true, detail: why });
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".htaccess") continue;
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (SKIP_DIRS.has(entry.name) || SKIP_DIRS.has(rel.replace(/\\/g, "/"))) continue;
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ------------------------------------------------------------ front matter --

/** Returns { files: [{path, body}], problems: [] } */
function frontMatterGate() {
  const roots = ["_pages", "_layouts", "_includes", "_posts", "_teaching"].filter((d) => {
    try {
      return statSync(join(ROOT, d)).isDirectory();
    } catch {
      return false;
    }
  });

  const files = roots.flatMap((d) => walk(join(ROOT, d))).filter((f) => /\.(md|markdown|html)$/i.test(f));
  const problems = [];

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");

    // Includes and layouts without front matter are normal; pages without it
    // are not: Jekyll would copy the file instead of rendering it.
    const startsWithFm = text.startsWith("---\n") || text.startsWith("---\r\n");
    const isContent = rel.startsWith("_pages/") || rel.startsWith("_posts/") || rel.startsWith("_teaching/");

    if (!startsWithFm) {
      if (isContent) problems.push(`${rel}: no front matter block`);
      continue;
    }

    const end = text.indexOf("\n---", 3);
    if (end === -1) {
      problems.push(`${rel}: front matter opened with --- and never closed`);
      continue;
    }

    const block = text.slice(text.indexOf("\n") + 1, end);
    if (/\t/.test(block)) {
      problems.push(`${rel}: tab character in front matter (YAML forbids tabs for indentation)`);
    }

    const keys = new Map();
    for (const line of block.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const m = line.match(/^([A-Za-z0-9_-]+)\s*:/);
      if (!m) continue;
      const key = m[1];
      if (keys.has(key)) problems.push(`${rel}: duplicate front matter key "${key}"`);
      keys.set(key, true);
    }
  }

  record(
    "front matter is structurally sound",
    problems.length === 0,
    problems.length ? problems.slice(0, 6).join(" | ") : `${files.length} files`,
  );
}

// ---------------------------------------------------------------- includes --

function includeGate() {
  // Only the directories Jekyll actually renders. Scanning the whole repo
  // catches prose in docs that merely quotes a tag — a false positive that
  // blocks a push for no reason.
  const liquidDirs = ["_pages", "_layouts", "_includes", "_posts", "_teaching", "_drafts"];
  const sources = liquidDirs
    .filter((d) => statSync(join(ROOT, d), { throwIfNoEntry: false }))
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => /\.(md|markdown|html)$/i.test(f));
  const missing = [];
  let count = 0;

  for (const file of sources) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/\{%-?\s*include\s+([^\s%}]+)/g)) {
      const name = m[1];
      count++;
      const candidates = [
        join(ROOT, "_includes", name),
        join(ROOT, "_includes", `${name}.html`),
        join(ROOT, "_includes", `${name}.md`),
      ];
      if (!candidates.some((c) => statSync(c, { throwIfNoEntry: false }))) {
        missing.push(`${rel} → {% include ${name} %}`);
      }
    }
  }

  record(
    "every {% include %} resolves",
    missing.length === 0,
    missing.length ? [...new Set(missing)].slice(0, 6).join(" | ") : `${count} includes`,
  );
}

// -------------------------------------------------------------------- sass --

function sassGate() {
  const main = join(ROOT, "assets", "css", "main.scss");
  const src = readFileSync(main, "utf8");
  const body = src.replace(/^---\r?\n---\r?\n/, ""); // Jekyll strips front matter; sass cannot parse it

  const dir = mkdtempSync(join(tmpdir(), "site-preflight-"));
  const input = join(dir, "main.scss");
  const output = join(dir, "main.css");
  writeFileSync(input, body);

  const cmd = `npx -y sass@1.77.8 --no-source-map --quiet --style=compressed --load-path="${join(
    ROOT,
    "_sass",
  )}" "${input}" "${output}"`;
  const run = spawnSync(cmd, { shell: true, encoding: "utf8", cwd: ROOT });
  const stderr = `${run.stderr || ""}`.trim();
  const offline = /EAI_AGAIN|ENOTFOUND|network|getaddrinfo|ECONNREFUSED/i.test(stderr);

  if (offline) {
    skip("main.scss compiles", "npx could not fetch sass (offline?)");
  } else if (run.status !== 0) {
    record("main.scss compiles", false, stderr.split(/\r?\n/).slice(0, 4).join(" | "));
  } else {
    const kb = (statSync(output).size / 1024).toFixed(1);
    record("main.scss compiles", true, `${kb} KB`);
  }
}

// ------------------------------------------------------------------ cv pdf --

function gitCommits(path) {
  const run = spawnSync(`git log --format=%H:%ct -- "${path}"`, { cwd: ROOT, shell: true, encoding: "utf8" });
  if (run.status !== 0) return [];
  return (run.stdout || "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, time] = line.split(":");
      return { hash, time: Number.parseInt(time, 10) };
    });
}

function cvPdfGate() {
  const pdf = "files/cv.pdf";
  const page = "_pages/cv.md";
  const pdfPath = join(ROOT, pdf);

  const pdfStat = statSync(pdfPath, { throwIfNoEntry: false });
  if (!pdfStat) {
    record("CV PDF exists", false, `${pdf} is missing`);
    return;
  }

  const commits = gitCommits(page);
  if (commits.length === 0) {
    skip("CV PDF is current", "cv.md has no committed history");
    return;
  }

  // Whichever is later: the commit that introduced the PDF, or the working
  // copy's mtime. A reprint that has not been committed yet counts as current.
  const pdfTime = Math.max(gitCommits(pdf)[0]?.time ?? 0, Math.floor(pdfStat.mtimeMs / 1000));
  const behind = commits.filter((c) => c.time > pdfTime).length;

  // One commit of lag is the documented two-step: deploy the page, then print
  // the PDF from the deployed page and commit it. Two is a forgotten reprint.
  record(
    "CV PDF is current",
    behind <= 1,
    behind === 0
      ? new Date(pdfTime * 1000).toISOString().slice(0, 16).replace("T", " ")
      : behind === 1
        ? "one commit behind — push this, then run `npm run cv:pdf` and commit the PDF"
        : `${behind} commits touch cv.md since the PDF — run \`npm run cv:pdf\``,
  );
}

// ------------------------------------------------------------------ report --

frontMatterGate();
includeGate();
sassGate();
cvPdfGate();

let failed = 0;
for (const { name, ok, skipped, detail } of results) {
  if (!ok) failed++;
  const label = skipped ? "SKIP" : ok ? "PASS" : "FAIL";
  console.log(`${label}  ${name}${detail ? `  — ${detail}` : ""}`);
}
console.log(`\n${results.filter((r) => !r.skipped).length - failed}/${
  results.filter((r) => !r.skipped).length
} preflight checks passed`);
process.exit(failed ? 1 : 0);
