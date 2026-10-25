# cai991108.github.io

Source of <https://cai991108.github.io> — an academic site: research, projects and a CV, built on Jekyll with the academicpages theme and published by GitHub Pages from `master`.

## Pages

| URL | Source | Holds |
| :-- | :-- | :-- |
| `/` | `_pages/about.md` | the front page: name, what I work on, four selected projects, the lab systems, skills, awards |
| `/research/` | `_pages/research.md` | directions and the two CROSS Joint Lab systems |
| `/projects/` | `_pages/projects.html` | every maintained repo, from `_data/projects.yml` |
| `/cv/` | `_pages/cv.md` | the CV; `files/cv.pdf` is printed from it |

The lab table (`_includes/lab-systems.html`) and the project cards (`_includes/project-cards.html`) are shared, so the homepage and the two inner pages cannot drift apart.

## Making a change

Edit the file, push to `master`, wait about 40 seconds. There is no local build step and no CI: GitHub Pages runs Jekyll itself.

Three things are not obvious:

- **No Ruby on this machine.** To check Sass before pushing, strip the front matter and run `npx sass --load-path=_sass` against `assets/css/main.scss`.
- **Colours and font stacks live in `_sass/_palette.scss`**, imported right after the theme's `_variables.scss`. The theme partials stay untouched so upstream can still be merged; site rules go in `_sass/_overrides.scss`.
- **The homepage has no `title:` in its front matter.** With one, the theme renders an `<h1>` and appends the site title to `<title>`, duplicating the name. The `<h1>` is written by hand in `_pages/about.md` instead.

## Checks

```bash
node scripts/check-site.mjs                                   # against the live site
SITE_URL=http://127.0.0.1:4000 node scripts/check-site.mjs    # against a local serve
```

It checks every page for a 200, for broken same-origin sub-resources, for leftover placeholder copy, for a description meta, and for layout overflow at 390px (that last one needs Chrome and is skipped when it is absent). It also pins what has to *stay* true: the brand colour in the built CSS, the CJK font stack, valid Person JSON-LD, a downloadable CV PDF, and seven retired template URLs still answering 404.

## Assets

```bash
python scripts/make-assets.py    # favicons, share card, square avatar
```

The full-resolution avatar source is deliberately not committed (`images/profile.src.jpg`, gitignored); put it back before regenerating `images/profile.webp`.

The CV PDF is printed from the live page, so it cannot disagree with it:

```bash
chrome --headless=new --no-pdf-header-footer \
  --print-to-pdf=files/cv.pdf https://cai991108.github.io/cv/
```

## Licence

Site content is mine. The theme is MIT, from [academicpages](https://github.com/academicpages/academicpages.github.io).
