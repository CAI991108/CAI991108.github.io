#!/usr/bin/env node
/**
 * Cut the Chinese webfont down to the characters this site actually sets.
 *
 *     npm run fonts
 *
 * The full Noto Serif SC is 15.7 MB as woff2 (31,058 glyphs), and Google's own
 * slicing still costs 5.75 MB for one weight. This site sets a few hundred Han
 * characters, so the only sane shape is a subset: measured here at roughly
 * 90-100 KB per weight for the current copy.
 *
 * The character set is taken from the repository's own text — every `.md`,
 * `.html` and `.yml` under the site's content and template directories — plus
 * printable ASCII and the Chinese punctuation the copy uses. That is a superset
 * of what any one page needs, which is deliberate: a character that is missing
 * from the subset falls back to a system font mid-sentence, and that is a worse
 * failure than 20 KB of unused glyphs.
 *
 * Re-run this whenever Chinese copy changes. `npm run preflight` refuses a push
 * when the .woff2 files are older than the copy they were cut from.
 *
 * The source font is not committed (24 MB, and undistributable in a Jekyll
 * build anyway). Put it here first:
 *
 *     assets/fonts/src/NotoSerifSC[wght].ttf
 *
 * from https://github.com/google/fonts/blob/main/ofl/notoserifsc (SIL OFL 1.1).
 * Load from the TTF, not the CFF/OTF build in notofonts/noto-cjk: brotli
 * compresses CFF charstrings badly enough that the same glyph set came out
 * 2.6x larger when measured.
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets/fonts/src/NotoSerifSC[wght].ttf");
const WEIGHTS = [400, 600];

// Chinese punctuation the copy actually uses, plus the full-width forms a
// future sentence is likely to reach for.
const CJK_PUNCT =
  "、。，．；：？！「」『』（）《》〈〉【】〔〕…—～·〝〞“”‘’％＋－＝＿／＼＃＆＊";
const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)).join("");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function collectChars() {
  const dirs = ["_pages", "_data", "_includes", "_layouts"].map((d) => join(ROOT, d));
  const files = dirs.flatMap((d) => { try { return walk(d); } catch { return []; } });
  files.push(join(ROOT, "_config.yml"));

  const han = new Set();
  for (const f of files) {
    if (!/\.(md|html|yml|yaml)$/.test(f)) continue;
    for (const ch of readFileSync(f, "utf8")) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x4e00 && cp <= 0x9fff) han.add(ch);
    }
  }
  // Sorted, so the output does not depend on directory order.
  const sorted = [...han].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join("");
  return { text: sorted + CJK_PUNCT + ASCII, hanCount: han.size };
}

const source = (() => {
  try { return readFileSync(SRC); } catch {
    console.error("missing source font: assets/fonts/src/NotoSerifSC[wght].ttf");
    console.error("download it from https://github.com/google/fonts/tree/main/ofl/notoserifsc (SIL OFL 1.1)");
    process.exit(1);
  }
})();

const { text, hanCount } = collectChars();
console.log(`characters: ${hanCount} Han + ASCII + CJK punctuation`);

mkdirSync(join(ROOT, "assets/fonts"), { recursive: true });

for (const weight of WEIGHTS) {
  const out = await subsetFont(source, text, {
    targetFormat: "woff2",
    variationAxes: { wght: weight },
  });
  const file = join(ROOT, `assets/fonts/noto-serif-sc-${weight}.woff2`);
  writeFileSync(file, out);
  console.log(`${file.replace(ROOT + "/", "").replace(ROOT + "\\", "")}  ${(out.length / 1024).toFixed(1)} KB`);
}
