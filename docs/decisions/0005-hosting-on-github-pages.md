# 0005 — Hosting on GitHub Pages, deployed by GitHub Actions

- **Status:** Accepted
- **Date:** 2026-11-22

## Context
The MVP is feature-complete and should be playable at a public URL — as a portfolio piece, next to its source. The
app is a static site (Vite build → `dist/`, no backend). Every change already lands on `main` only through a pull
request the owner merges, with CI green. Options considered: GitHub Pages, Netlify, Vercel (all free for this).

## Decision
- **Host on GitHub Pages** at `https://michaelbeamish.github.io/creature-world/`.
- **Deploy with GitHub Actions** (`.github/workflows/deploy.yml`) on every push to `main`: the same five checks as CI,
  then the build is uploaded and published with GitHub's official Pages actions (`upload-pages-artifact`,
  `deploy-pages`). Pages is set to publish from Actions (not from a branch).
- **Vite `base`** is `/creature-world/` for the production build (the site lives on a sub-path); dev stays at `/`.

## Consequences
- ➕ Everything in one place: repo, CI, pull requests and the live site — no second account, dashboard or secrets.
- ➕ The owner stays the gatekeeper: only merged, checked code is published.
- ➕ The portfolio link points straight at the repo's own site.
- ➖ No per-PR preview links (Netlify/Vercel have them); changes are checked locally before verifying instead.
- ➖ The sub-path means asset URLs must stay relative to Vite's `base` (no hard-coded `/…` paths).
- A custom domain can be added later without changing this setup.
