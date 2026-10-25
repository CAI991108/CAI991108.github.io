# Chinese (`/zh/`) subtree for cai991108.github.io — platform, fonts, typesetting

Research for adding a hand-built Chinese version to a GitHub Pages–hosted academicpages
site. Every number below was either read from a primary source (linked) or measured
locally on 2026-10-25 with `fontTools 4.67.0` against the real font binaries; the
measurement method is stated wherever a number is mine rather than a vendor's.

Site facts taken as given: English-only, 4 pages, `locale: en`, `_layouts/default.html:8`
hardcodes `<html lang="{{ site.locale | slice: 0,2 }}">`, layouts read UI strings
globally via `site.data.ui-text[site.locale]` (`_layouts/single.html:34,42,62,66,85`),
build is GitHub Pages' own Jekyll, no CI.

---

## A1. Which Jekyll plugins GitHub Pages actually allows

**Verdict.** The whitelist is the dependency list of the `github-pages` gem, published
machine-readably. It contains **47 gems**; `jekyll-redirect-from` **0.16.0 is on it**;
**`jekyll-polyglot` is not, and neither is any other multi-language/i18n plugin**
(no `jekyll-multiple-languages`, no `jekyll-i18n`, no `jekyll-polyglot` variant).
`jekyll-seo-tag` 2.8.0 and `jekyll-sitemap` are on it. Pinned versions of note:
`github-pages` 232, `jekyll` **3.10.0** (not 4.x), `kramdown` 2.4.0, `sass` 3.7.4.

**Evidence.**
- Authoritative list: <https://pages.github.com/versions.json> (JSON; 47 entries, fetched 2026-10-25). Rendered: <https://pages.github.com/versions/>.
- GitHub Docs, *About GitHub Pages and Jekyll* — "GitHub Pages uses plugins that are enabled by default and cannot be disabled" (lists 9), then: "For a list of supported plugins, see Dependency versions", and the hard limit: **"GitHub Pages cannot build sites using unsupported plugins. If you want to use unsupported plugins, generate your site locally and then push your site's static files to GitHub."** Source markdown: <https://github.com/github/docs/blob/main/content/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll.md>. Same page pins the config GitHub forces: `safe: true`, `lsi: false`, `incremental: false`, `highlighter: rouge` — "Some configuration settings cannot be changed for GitHub Pages sites."
- Why an unlisted plugin fails *quietly*: Jekyll's plugin loader filters by whitelist when in safe mode — `plugin_allowed?` returns `!site.safe || whitelist.include?(plugin_name)` and is applied as `site.gems.select { |plugin| plugin_allowed?(plugin) }` (<https://github.com/jekyll/jekyll/blob/master/lib/jekyll/plugin_manager.rb>). The gem is never required, so nothing raises; the feature simply does not exist. Treat "no feature, no clear error" as the expected outcome, not a build failure.
- Polyglot agrees it is not supported: its README's own roadmap has an **unchecked** box "get whitelisted as an official github-pages jekyll plugin" (<https://github.com/untra/polyglot/blob/main/README.md>).
- Escape hatches: (a) build locally and commit `_site`; (b) switch the Pages source to a GitHub Actions workflow — GitHub's publishing-source doc offers exactly two models, "Deploy from a branch" or "write a GitHub Actions workflow to publish your site" (<https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>). Option (b) changes the deploy model (build runs in Actions with any gem; the branch stops being the artifact), and the docs now prefix the whole Jekyll page with an "Actions is preferred" note.

**What it implies for this site.** `jekyll-polyglot` is off the table without changing how
the site deploys. Given 4 pages and a few hundred words, the plugin was never the win:
a hand-built `/zh/` tree costs one source file per page and zero deploy changes. Note the
upside: `jekyll-redirect-from` **is** available and already in `plugins:`, so real
build-time HTML redirects are on the table (useful for `?lang=` fallbacks or for moving
a page later). Also note `jekyll` 3.10.0 on the host: anything written must work on
Jekyll 3, not 4 (e.g. no `where_exp`-free assumptions, no Jekyll 4-only filters).

---

## A2. The plugin-less hand-rolled `/zh/` pattern

**Verdict.** One source file per page per language (`_pages/research.md` +
`_pages/zh/research.md`), `lang:` in front matter, `<html lang>` from `page.lang`,
and a set of `<link rel="alternate" hreflang>` tags that is **identical on every
version of the page and includes the page itself**. Reciprocity is mandatory: if two
pages do not both point at each other, Google ignores the tags. `x-default` is the
fallback for unmatched languages. `<html lang>` is still correct to set (it drives
fonts, hyphenation, screen readers) but **Google does not use it to detect language** —
so `lang` is not an SEO mechanism, hreflang is.

**Evidence.**
- Google Search Central, *Tell Google about localized versions of your page*
  (<https://developers.google.com/search/docs/specialty/international/localized-versions>), verbatim:
  - "Each language version must list itself as well as all other language versions."
  - "Alternate URLs must be fully-qualified, including the transport method (http/https)."
  - "If two pages don't both point to each other, the tags will be ignored."
  - "Google doesn't use hreflang or the HTML lang attribute to detect the language of a page; instead, we use algorithms to determine the language."
  - "Localized versions of a page are only considered duplicates if the main content of the page remains untranslated." ← the key sentence for a 4-page site: a genuinely translated page is **not** a duplicate; a page with English body and a Chinese nav is.
  - `x-default` = "the fallback page for users whose language settings don't match any of your localized versions."
  - Script subtags are supported and preferable to region guessing: `zh-Hans` (Simplified), `zh-Hant` (Traditional) — "when using `zh-TW` … the language script is automatically derived". Codes are case-insensitive; region uppercase by convention.
  - Three delivery methods (HTML `<link>`, HTTP `Link:` header, sitemap) are "equivalent from Google's perspective"; using all three buys nothing.
- Sitemap method requires `xmlns:xhtml="http://www.w3.org/1999/xhtml"` and, per `<url>`, child `<xhtml:link rel="alternate" hreflang="…" href="…"/>` entries listing **every** version including itself (same doc).

**`jekyll-sitemap` behaviour (checked against the plugin source, not docs).** The
plugin's template (`lib/sitemap.xml` in <https://github.com/jekyll/jekyll-sitemap>) emits
a plain `<urlset>` with `<loc>`/`<lastmod>` only — **no `xhtml:link`, no hreflang**,
and no awareness of language at all. Consequences:
1. It will list `/zh/research/` as its own `<url>` alongside `/research/`. That is
   correct and harmless — a translated page is a distinct URL that should be indexed.
2. The sitemap route to hreflang is therefore unavailable unless the sitemap is
   hand-written or the plugin's template is overridden; use HTML `<link>` tags instead.
3. Sitemap inclusion is only a **weak** canonical signal (Google ranks the methods:
   redirects > `rel="canonical"` > sitemap inclusion —
   <https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>).
4. Escape hatch that does exist: the template honours `sitemap: false` front matter
   (`where_exp:'doc','doc.sitemap != false'`), so any page you do *not* want indexed can
   be dropped per page without touching the plugin.

**What it implies for this site.** Two mechanical changes, both small:
- `_layouts/default.html:8`: `<html lang="{{ page.lang | default: site.locale | slice: 0,2 }}">`. Note the current `slice: 0,2` would turn `zh-Hans` into `zh` — decide which value you store and stop slicing, or keep `zh-CN` and slicing degrades gracefully to `zh`.
- Every `site.data.ui-text[site.locale]` lookup (`single.html`, `talk.html`) should become `site.data.ui-text[page.lang | default: site.locale]`, otherwise Chinese pages get English chrome. `_data/ui-text.yml` already ships `zh`, `zh-CN`, `zh-HK`, `zh-TW` blocks (lines 271, 308, 313, 350), so this is a one-token change per lookup, no new data.
- Use `hreflang="zh-Hans"` (not `zh-CN`) if the content is Simplified regardless of region; keep `en` and `x-default` → the English URL. Emit the identical tag set from a single include so it cannot drift out of reciprocity.
- Nav: `_data/navigation.yml` is global; a `_data/navigation-zh.yml` plus a `page.lang`-aware `_includes/masthead.html` is the least invasive split (no plugin needed).

---

## A3. `?lang=zh` query-string switch

**Verdict.** Don't. On a static host a query string cannot change the HTML that is
served — every visitor and every crawler gets the same English document, and the switch
becomes client-side JS. Google's index therefore holds exactly one page, and hreflang
annotations inside that one document would be describing versions Google cannot fetch as
distinct content. Google explicitly permits query strings in URLs and even documents
their encoding (`?k=v&k2=v2`), but that is permission to *use* them, not evidence they
are a good language switch; the duplicate-content guidance then applies, with
`rel="canonical"` the strongest non-redirect signal available.

**Evidence.** URL structure and parameter encoding:
<https://developers.google.com/search/docs/crawling-indexing/url-structure> (parameters
with `=` and `&`; avoid session IDs; hyphens not underscores). Canonicalisation ranking
and duplicate handling: <https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>
("Redirects: A strong signal… `rel="canonical"` link annotations: A strong signal…
Sitemap inclusion: A weak signal"). Faceted-navigation crawling (why parameterised URL
spaces burn crawl budget): <https://developers.google.com/crawling/docs/faceted-navigation>.
No first-party Google document was found that blesses `?lang=` specifically as a
localisation mechanism — the localisation doc's three methods are all about *distinct,
fetchable URLs*.

**What it implies for this site.** Path-based `/zh/` is the only option that produces
crawlable, self-canonical, hreflang-able URLs on GitHub Pages — one directory, one file
per page, no server logic. A `?lang` toggle is acceptable only as a *convenience
redirect* (JS or `jekyll-redirect-from`), never as the canonical address of the Chinese
content.

---

## B1. Noto Serif SC / Source Han Serif — licence, weights, real woff2 sizes

**Verdict.** SIL OFL 1.1, free to self-host and subset. One variable font, `wght`
200–900, 31,058 glyphs. But the sizes are the story: the **full font is 15.71 MB as
woff2**, and Google's CSS API splits it into **101 `unicode-range` slices per weight**
totalling **5.75 MB for weight 400 alone** — with a **median slice of 64.2 KB**, i.e.
one single slice costs about as much as this site's entire Latin font pair (30.6 KB, measured).

**Evidence & measurements.**

| Item | Bytes | Notes |
|---|---|---|
| `NotoSerifCJKsc-Regular.otf` (static, CFF) | 24,543,080 (23.41 MB) | notofonts/noto-cjk release |
| `NotoSerifSC[wght].ttf` (variable, TTF) | 25,125,512 (23.96 MB) | google/fonts |
| full font → woff2 (`--unicodes=U+0-10FFFF`) | **16,476,500 (15.71 MB)** | measured with pyftsubset |
| Google CSS API, wght 400, all slices | **6,030,988 (5.75 MB)** | sum of 101 `content-length` |
| slices per weight | **101** (202 for 400+600) | 202 `@font-face` blocks |
| median slice / max slice | **65,740 B (64.2 KB)** / 104,964 B (102.5 KB) | min 2,416 B |
| `fvar` axes | `wght` 200–900 | measured |
| glyphs | 31,058 | measured |

Sources: licence text <https://github.com/google/fonts/blob/main/ofl/notoserifsc/OFL.txt>
("Copyright 2012 Google Inc… SIL Open Font License, Version 1.1"); Source Han Serif as
the Adobe twin with the same OFL, plus OTF/OTC/Variable OTF/TTF/WOFF2 configurations
(<https://github.com/adobe-fonts/source-han-serif>); formats and download matrix for
Noto Serif CJK (<https://github.com/notofonts/noto-cjk/blob/main/Serif/README.md>).
Slicing behaviour measured against
`https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&display=swap`
requested with a Chrome UA (woff2 + `unicode-range`), 2026-10-25.

**What it implies for this site.** Full self-hosting is out: 15.71 MB is ~500× the HTML
of the pages it would style. Even the "just use Google Fonts CDN" path is not a free
lunch — a Chinese page pulls only the slices it needs, but those slices are 60 KB each
and the count is not under your control. Any Chinese webfont plan has to be a subset
(B2) or a system stack (B3).

---

## B2. Subsetting to the glyphs the site actually uses

**Verdict.** Realistic and cheap **if you subset from a TTF (glyf) source**: an
825-character set (700 Han + ASCII + CJK punctuation) is **141.6 KB** at weight 400 and
**143.8 KB** at 600, ~1.1× the size of 700 Han alone, and independent of the 15.71 MB
original. Subsetting the **CFF/OTF** build of the same font instead costs **364.7 KB**
for the same glyph set — **2.6× larger** — because brotli compresses CFF charstrings far
worse than `glyf`. That is the single most consequential detail in this section.

**Command shape** (what was actually run, `fontTools 4.67.0`, `brotli` present):

```sh
# 1. optional: pin one weight out of the variable font
fonttools varLib.instancer NotoSerifSC\[wght\].ttf wght=400 -o NotoSerifSC-400.ttf

# 2. subset to the exact characters used, emitting woff2
pyftsubset NotoSerifSC-400.ttf \
  --text-file=chars.txt \
  --flavor=woff2 \
  --output-file=noto-serif-sc-subset.woff2
```

Build `chars.txt` from the rendered site plus the punctuation and ASCII the pages really
use — the set that produced the table below was 700 frequency-ranked Han characters +
`、。，；：？！「」『』（）《》〈〉【】…—·～` + printable ASCII.

| Glyph set | woff2 @400 | woff2 @600 |
|---|---|---|
| 600 Han | 110,700 B (108.1 KB) | 112,416 B (109.8 KB) |
| 700 Han | 132,164 B (129.1 KB) | 134,248 B (131.1 KB) |
| 900 Han | 171,876 B (167.8 KB) | 174,620 B (170.5 KB) |
| 700 *rare* Han (upper bound) | 149,936 B (146.4 KB) | 151,996 B (148.4 KB) |
| **825 = 700 Han + punct + ASCII** | **145,036 B (141.6 KB)** | **147,232 B (143.8 KB)** |
| same 825 set, from the CFF OTF | 373,448 B (364.7 KB) | — |
| 3,500 Han (CFF OTF) | 687,752 B (671.6 KB) | — |

All sizes measured locally; Han sets are frequency-ranked distinct characters from a
real Chinese corpus (so the 600/700/900 rows are a *lower* bound — the rarest-700 row,
+13%, brackets the realistic worst case for the same count).

**The trade-off, stated plainly.** A subset is a snapshot: any character not in
`chars.txt` falls back **mid-sentence** to a system font, producing a visible style
break on a single glyph — the classic symptom being one character in a different
serif/sans, or tofu if the fallback also lacks it. Practically: (a) the build must
regenerate the subset whenever page text changes, or the drift is silent; (b) always
keep the CJK stack *behind* the webfont so fallback is graceful rather than fatal;
(c) include 简/繁 variants if the copy ever mixes them (this set did not); (d) budget
~142 KB per weight — two weights ≈ 285 KB, versus 30.6 KB for both Latin weights
(measured: `assets/fonts/source-serif-4-400.woff2` 15,152 B, `…-600.woff2` 16,152 B).

---

## B3. Cross-platform CJK fallback stacks

**Verdict.** If the site does not ship a Chinese webfont, name the platform families
explicitly — do not rely on a bare `serif`, which resolves to different designs per OS.
Serif body stack and sans label stack are different problems (宋体-style vs 黑体-style).

**Evidence — what actually exists on each platform.**
- **macOS / iOS**: `Songti SC` and `PingFang SC` are listed in Apple's system font
  catalogue; Songti SC is marked a macOS system font
  (<https://developer.apple.com/fonts/system-fonts/>). PingFang SC is the UI sans.
- **Windows**: `SimSun` and `Microsoft YaHei` are in the base Windows 11 font list, but
  **`KaiTi`, `FangSong`, `SimHei`, `DengXian` appear only under "Chinese (Simplified)
  Supplemental Fonts"** — i.e. absent unless the language pack is installed. Do not put
  KaiTi/FangSong in a stack you need to render reliably.
  Source: <https://learn.microsoft.com/en-us/typography/fonts/windows_11_font_list>
  (SimSun `Simsun.ttc` 5.18, Microsoft YaHei `Msyh.ttc` 6.25 in the main table; the
  supplemental table lists DengXian/FangSong/KaiTi/SimHei).
- **Linux**: Noto Serif CJK SC / Noto Sans CJK SC are the packaged defaults on
  Debian/Ubuntu/Fedora (and the source of the Android CJK fonts); Noto Serif CJK is the
  same design as Source Han Serif.
- **Android**: ships the Noto Sans CJK (Source Han Sans) family; a *serif* CJK face is
  frequently absent, so on Android a serif CJK stack will fall through to sans — expect
  the body serif to degrade, and make sure degradation looks intentional.

**Recommended stacks.**

```css
/* body — 宋体/Song/Ming serif */
--font-zh-serif: "Songti SC", "SimSun", "Noto Serif CJK SC",
                 "Source Han Serif SC", "Noto Serif SC", serif;

/* labels, nav, metadata — 黑体/Hei sans */
--font-zh-sans: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC",
                "Source Han Sans SC", "Noto Sans SC", sans-serif;
```

**What it implies for this site.** Zero bytes, zero build step, and correct on the two
platforms that matter most for an academic audience (macOS `Songti SC`, Windows
`SimSun`). The cost is that the Chinese text will not match the Latin Source Serif 4
beside it — different foundry, different contrast — and Android will render it sans.
Given a 4-page site, "system stack, accept the mismatch" is a defensible default and the
cheapest option by two orders of magnitude; the subset in B2 is the upgrade path.

---

## B4. Pairing Source Serif 4 with a CJK serif

**Verdict.** Source Serif 4 contains **zero** CJK glyphs — confirmed by inspecting the
files already in this repo, not by reading a specimen. It is not a "small-coverage"
problem you can paper over: 200 cmap entries, 245 glyphs, no Han, no kana, no full-width
punctuation. So Chinese text *always* comes from another font, and the only question is
which one and at what size. Noto Serif CJK SC is a reasonable partner (both are serif,
both OFL, comparable stroke contrast) but it is **not the same Latin design** and it runs
**larger**: its Latin x-height is 51.4% of the em versus 47.5% for Source Serif 4, so at
the same `font-size` the CJK font's Latin looks ~8% bigger than the Latin font's.

**Evidence (all measured with fontTools on the actual binaries).**

| Metric | Source Serif 4 (this repo, 400) | Noto Serif CJK SC Regular |
|---|---|---|
| cmap entries / glyphs | 200 / 245 | — / 31,058 (VF) |
| Han, kana, full-width punct | **0 / 0 / 0** | present |
| units per em | 1000 | 1000 |
| x-height (OS/2 `sxHeight`) | 475 (**47.5%**) | 514 (**51.4%**) |
| cap height (`sCapHeight`) | 670 (67.0%) | 729 (72.9%) |
| advance of `o` | 564 | 596 |
| advance of `x` | 548 | 564 |
| advance of a Han character | n/a | **1000** (full em square) |

The differing `o`/`x` advances (564 vs 596, 548 vs 564 — Noto ~5–6% wider) are the
evidence that Noto Serif CJK's Latin is *not* Source Serif: the two are related in genre,
not shared in outline. Han characters occupy the full em box, so a Han glyph is roughly
2× the visual mass of a Latin lowercase at the same `px`.

**What it implies for this site.** Don't set both at 17–18px and hope. Two cheap fixes:
(a) give the Chinese body one step down — Latin 17px / CJK 16px — which cancels most of
the 8% x-height gap; or (b) keep one size and use `font-size-adjust` on the CJK run
(`font-size-adjust: 0.475` normalises to Source Serif 4's x-height, though support is
uneven and it interacts badly with `line-height`). Also expect **line-height to need
raising** for Chinese: CJK glyphs fill the em vertically, so a `line-height` tuned for
Latin (e.g. 1.5) reads tighter in Chinese; 1.7–1.8 is the usual correction. And since the
sibling ticket's Latin subset is LATIN-ONLY (30.6 KB for both weights), any CJK webfont
is strictly **additional** download — there is no shared-file saving to be had.

---

## C1. clreq on line length, indent, and punctuation

**Verdict.** clreq gives hard numbers, and the site's existing Latin measure already sits
inside them. For **book body text: 17–40 characters per line**, minimum **10**, maximum
**48** horizontal (55 vertical). First-line indent: **2 em** standard, **1 em** only for
narrow multi-column. Chinese is set **solid** (密排) — no `letter-spacing`, no added
word space — and every character, punctuation included, is designed on a **square** box.

**Evidence.** W3C *Requirements for Chinese Text Layout* (clreq), §Line & paragraph
layout — <https://www.w3.org/TR/clreq/> (editor's copy used:
<https://w3c.github.io/clreq/>). Verbatim: "most books have line lengths of body text in
the range between 17 to 40 characters… the line length of body text should not be less
than 10 characters. For horizontal writing mode, the line length of body copy should not
exceed 48 characters." §Paragraph adjustment: "Chinese publications usually apply 2-em
wide first-line indents… magazines with multi-column content… might apply a 1-em wide
first-line indent." §Basic principles: "All characters used in Chinese typesetting
(including Han characters and punctuation) are square characters"; "Characters in
Chinese typesetting are set solid."

**What it implies for this site.** The Latin measure (~62ch) maps to **~31 full-width
characters** — comfortably inside clreq's 17–40 band, so the *width* needs no retune.
But express it in `em` on the Chinese pages (`max-inline-size: 32em`), because `ch`
is defined off the `0` glyph and will silently change meaning when the first font in
the stack becomes a CJK face. Two real changes: (a) `text-indent: 2em` on Chinese
paragraphs, replacing `margin`-based paragraph spacing — or keep spacing *and* drop the
indent, but don't do both; (b) remove any `letter-spacing` and word-spacing on Chinese
runs (clreq's "set solid"), and stop relying on justification gaps: Chinese lines are
flush except the last.

---

## C2. Emphasis without italics — 着重号 vs bold vs 楷体

**Verdict.** Chinese has no italic convention (clreq's italics section is still
**"TBD(?)"** — an unfilled placeholder, which is itself the answer). The standard 着重
mark is **着重号**: a dot **below** the characters in horizontal writing, encoded as
`U+25CF BLACK CIRCLE` or `U+2022 BULLET`. It is one of the 标号 in **GB/T 15834—2011**
(as restated by clreq). CSS `text-emphasis` is now safe to use: **Baseline "widely
available" since March 2022** (Chrome 99, Firefox 46, Safari 7 — plus their mobile
mirrors), and Chinese's preferred position is **`under right`**, *not* the CSS default
`over right` (which is the Japanese convention) — so it must be set explicitly.

**Evidence.**
- clreq §Emphasis & highlighting: "Emphasis marks, also known as emphasis dots, are
  symbols placed on the line head or line foot to emphasize the text… For horizontal
  writing mode, emphasis marks are placed under the characters… Both U+25CF BLACK CIRCLE
  [●] or U+2022 BULLET [•] can work as emphasis marks." The section states it follows
  *General Rules for Punctuation* (GB/T 15834—2011) for Mainland usage.
  <https://www.w3.org/TR/clreq/>
- clreq §Letterform slopes, weights, & italics: heading followed by "TBD(?)" — no
  italic requirement is specified for Chinese.
- MDN `text-emphasis`: "Baseline Widely available… available across browsers since
  March 2022" — <https://developer.mozilla.org/en-US/docs/Web/CSS/text-emphasis>.
  Compat data (MDN BCD): Chrome 99, Firefox 46, Safari 7; `standard_track: true`,
  `experimental: false`.
- MDN `text-emphasis-position`: "for Chinese… the preferred position is `under right`",
  with the summary table giving Chinese = under (horizontal) / right (vertical) vs
  Japanese = over/right — <https://developer.mozilla.org/en-US/docs/Web/CSS/text-emphasis-position>.

**What it implies for this site.**

```css
:lang(zh) em, :lang(zh) .em {          /* or a dedicated class */
  font-style: normal;                   /* italics are wrong here */
  -webkit-text-emphasis: dot;           /* Safari still wants the prefix */
  text-emphasis: dot;
  text-emphasis-position: under right;  /* override the JP default */
  text-emphasis-color: currentColor;
}
```

Bold is acceptable and cheap but reads heavier in CJK than in Latin (fewer counters, more
ink), so reserve it for headings. **楷体** is the traditional typographic alternative, but
it is a *third* font download (and on Windows it lives in the supplemental pack per B3) —
not worth it for a 4-page site.

---

## C3. Other clreq requirements a Latin-first CSS gets wrong

**Verdict.** Four things, in order of how visibly they break:
1. **Line breaking (禁则)** — Chinese breaks between any two characters, but a line may
   not *start* with closing punctuation or *end* with opening punctuation. CSS:
   `line-break: strict` (Chrome 58 / Firefox 69 / Safari 11). Without it you get
   。 and 」 orphaned at line start.
2. **标点挤压 (punctuation compression)** — full-width punctuation carries a half-em of
   built-in空白; quality CJK setting squeezes it. CSS `text-spacing-trim` exists but is
   **Chrome 123 only** (Firefox and Safari: no support) — treat as progressive
   enhancement, never as a layout dependency.
3. **Mixed CJK + Latin spacing (中西文混排)** — needs ~¼ em between a Han character and a
   Latin word. Historically hand-spaced or not done at all; `text-autospace` has just
   become cross-browser: **Chrome 140, Firefox 145, Safari 18.4**. For older engines, a
   literal space in the source is the fallback — and it must be a *real* space, not
   `letter-spacing` (which violates "set solid").
4. **Hanging punctuation** — `hanging-punctuation` is **Safari 26.5 only**; do not rely
   on it to make flush-left Chinese punctuation look right.

**Evidence.** clreq §Line breaking & hyphenation with its "prohibition rules for
unbreakable marks" and §Line adjustment (which exists precisely because "line lengths
[are] uneven" once 禁则 is honoured) — <https://www.w3.org/TR/clreq/>. Property support
read from MDN browser-compat-data, `css/properties/*.json`:
<https://github.com/mdn/browser-compat-data> (`line-break` 58/69/11;
`text-spacing-trim` Chrome 123, `firefox: false`, `safari: false`, `experimental: true`;
`text-autospace` Chrome 140, Firefox 145, Safari 18.4, `experimental: false`;
`hanging-punctuation` Safari 26.5 only).

**What it implies for this site.** A `:lang(zh)` block of five declarations buys most of
the quality:

```css
:lang(zh) {
  line-break: strict;            /* 禁则 */
  text-autospace: normal;        /* 中西文混排, 2024+ engines */
  letter-spacing: normal;        /* clreq: set solid */
  word-break: normal;
  overflow-wrap: anywhere;       /* long Latin URLs inside Chinese prose */
}
```

Add `text-spacing-trim: trim-start` only if you accept it as a Chrome-only nicety. None
of this requires a plugin, a build step, or a byte of download.

---

## Summary table

| Q | Verdict | Cost to this site |
|---|---|---|
| A1 | No i18n plugin whitelisted (47 gems; `redirect-from` yes, `polyglot` no, and it would fail silently). Only escape is local build or Actions deploy. | 0 — hand-roll instead |
| A2 | One file per language + per-page `lang` + self-inclusive, reciprocal hreflang + `x-default`. `jekyll-sitemap` emits no hreflang. | 2 layout edits, 1 include, 1 nav data file |
| A3 | `?lang` cannot serve different HTML on a static host → crawler sees only English. Use `/zh/`. | 0 (avoid) |
| B1 | Noto Serif SC: OFL 1.1, 200–900, 31,058 glyphs; 15.71 MB as woff2; 101 slices/weight, 5.75 MB, median slice 64.2 KB. | prohibitive full-font |
| B2 | Subset from **TTF**, not OTF: 825 chars = 141.6 KB/weight (CFF would be 364.7 KB). Missing glyph falls back mid-sentence. | ~285 KB for two weights |
| B3 | System stacks: Songti SC/SimSun/Noto Serif CJK SC; PingFang SC/Microsoft YaHei/Noto Sans CJK SC. Windows KaiTi/FangSong need the supplemental pack. | 0 bytes |
| B4 | Source Serif 4 has 0 CJK (measured). Noto Serif CJK's x-height is +8.2% and its Latin is a different design; drop CJK one step to 16px, raise line-height. | 0 |
| C1 | clreq: 17–40 chars/line (10 min, 48 max), 2em indent, set solid. 62ch ≈ 31 chars — already in band. | `em` measure + `text-indent` |
| C2 | 着重号 = dot below (U+25CF/U+2022); `text-emphasis` Baseline since Mar 2022; must set `under right`; no italics (clreq TBD). | 5 CSS declarations |
| C3 | `line-break: strict` broadly supported; `text-autospace` now cross-browser; `text-spacing-trim` Chrome-only; `hanging-punctuation` Safari-only. | 5 CSS declarations |

---

## Open questions for the human

1. **Simplified or Traditional, and which tag?** `zh-Hans` is the honest hreflang for
   Simplified content; `zh-CN` is region-flavoured and `_data/ui-text.yml` already has
   `zh`, `zh-CN`, `zh-HK`, `zh-TW`. Pick one and use it as both `lang:` and
   `hreflang` — note `default.html`'s `slice: 0,2` would truncate `zh-Hans` to `zh`.
2. **Full parallel tree, or only some pages in Chinese?** Four pages is cheap to
   duplicate; three is cheap too, but a *partial* tree means hreflang sets differ per
   page and `x-default` has to point somewhere sensible. Which pages are worth
   translating (CV? projects?) is a judgement call about the audience.
3. **System stack (0 KB, mismatched) or subset webfont (~285 KB, consistent)?** The
   measurable gap is 141.6 KB/weight for ~825 glyphs, vs 15.71 MB for the whole font.
   You may also want a middle option: subset **only for the heaviest pages** and let the
   rest fall back.
4. **Who regenerates `chars.txt`?** A subset silently rots when copy changes. Options:
   a `scripts/` harness run by hand before commit (the repo already has `scripts/`), or
   accept system fonts and skip the problem. This is the main ongoing maintenance cost
   of B2.
5. **Language switch affordance.** A swap link in the masthead (`EN / 中文`) is the
   smallest thing that works and needs no JS; confirm placement doesn't disturb the
   existing 3-item nav in `_data/navigation.yml` / `_includes/masthead.html`.
6. **Do Chinese pages get their own `og_locale`?** `_config.yml` pins `og_locale:
   "en_US"` globally; `zh_CN` / `zh_TW` would need a per-page override for share cards
   to be accurate.
