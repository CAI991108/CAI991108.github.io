# AGENTS.md

This repository is the source of `https://cai991108.github.io` — a Jekyll site on the academicpages template, published by GitHub Pages from `master`.

Changing the site — page map, the three non-obvious gotchas, and how to verify a change: `README.md`.

More than one session in this repo at a time: give each its own `git worktree`, and stage explicit paths — a concurrent commit can swallow a `git add -A` and the push then reports "Everything up-to-date" with the work still uncommitted.

The site is bilingual: `/` and `/research/` have Chinese twins under `/zh/`, and `npm run check` holds each pair together. Editing one side of a pair means editing the other; Chinese copy also needs `npm run fonts` (the subset lives in `assets/fonts/`, cut from a gitignored source face).

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `CAI991108/CAI991108.github.io`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, each label string equal to its role name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), kept apart from the `wayfinder:map` / `wayfinder:research` / `wayfinder:prototype` / `wayfinder:grilling` / `wayfinder:task` ticket labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`, no `GLOSSARY-MAP.md` and no per-subproject glossaries. See `docs/agents/domain.md`.
