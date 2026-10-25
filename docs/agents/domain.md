# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** One repository, one shared `GLOSSARY.md` at the repo root, one `docs/adr/` for architecture decisions. There is no `GLOSSARY-MAP.md` and no per-subproject `GLOSSARY.md` — this repo has no monorepo signals (no workspace file, no multi-package tree), so the whole site is one context.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

Both are deliberately absent right now: this repo was initialised as single-context without creating a stub `GLOSSARY.md`, empty `docs/adr/`, `GLOSSARY-MAP.md`, or any subproject glossary. The first real term or decision is what creates them.

## File structure

Single-context repo (this repo):

```
/
├── GLOSSARY.md          ← created on first real term
├── docs/
│   ├── adr/             ← created on first real decision
│   │   └── 0001-....md
│   └── agents/          ← this setup
└── _pages/  _includes/  _layouts/  _data/  images/  ...
```

Do **not** introduce `GLOSSARY-MAP.md` or per-subproject `GLOSSARY.md` by default. Switching to multi-context is a deliberate decision (record it as an ADR), not a drift that happens because a directory grew.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Legacy file names

Newer skills only recognise `GLOSSARY.md` and `GLOSSARY-MAP.md`. If you ever find a `CONTEXT.md` or `CONTEXT-MAP.md` in this repo, rename it to the matching glossary name — and update every reference in this file to the new name. One thing changes, both places move.
