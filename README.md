# Creature World 🐙

[![CI](https://github.com/MichaelBeamish/creature-world/actions/workflows/ci.yml/badge.svg)](https://github.com/MichaelBeamish/creature-world/actions/workflows/ci.yml)

A tiny living tide pool in the browser. Above a moonlit sea floor of sand, mossy rocks, glowing shells and
swaying seaweed, soft, furry, octopus-like creatures breathe, blink, wander and rest —
and when you move your cursor near them, each one reacts in its own way. You can boop them, or pick them up
and drag them around (they wriggle and squeak — gently). Shake one too hard and it squirts ink and keeps its
distance for a while — except the Grumpy, which gets mad and chases you, squirting whenever you get close, and the
Friendly, which just hiccups, gets dizzy and forgives you. A treasure chest on the sand holds treats and toys:
drop a shrimp in and each personality goes for it in its own way, or toss in the rubber duck or the soccer ball and
watch the Friendly play fetch, the Peeker nudge it, the Grumpy swat it away and the Scaredy sneak a
nudge when nobody's looking. There's dress-up too — hats, a tiara, glasses, a beard, a clown nose and wig, mouse ears, glowing rave gear and kandi, plus things
to hold — a glow stick, a wand, a balloon that floats away if let go… (the Grumpy shakes them off; the others pick up
whatever is lying around and put it on).

It should feel like **discovering something alive**, not using a website.

## Meet the residents

Every creature has a personality — an **archetype** on shared trait dials (curiosity × boldness):

|                 | **Timid**                                                     | **Bold**                                                        |
| --------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| **Curious**     | **Peeker** — creeps closer, darts back when startled, returns | **Friendly** — comes right up, follows you, may blush and ♥     |
| **Not curious** | **Scaredy** — keeps its distance, hides in a far corner       | **Grumpy** — ignores you until bothered, then puffs up red 💢   |

They read what you're doing — **calm presence**, **sudden movement**, or **chasing** — and show how they feel with
their eyes, body language, emote bubbles, and (if you unmute) their own little voices. Scare one and it darts off
in a stream of bubbles; annoy a Grumpy and it huffs.

## Try it

Requires Node ≥ 22.12 and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

- **Click** a creature to boop it; **press and hold** (head or tentacle) to pick it up and drag it. Works with touch too.
  Shake it hard and it inks — each personality has its own limit (watch for the tremble).
- Click the **treasure chest** (bottom-left) to open it, and drag a **shrimp**, the **rubber duck** or the **soccer
  ball** into the water. Drag a toy back onto the chest to put it away.
  Turn the pages with ‹ › or jump straight to one with the dots below them: **dress-up** items and things to hold — drop one on a creature to put it on, press it to take it off. Items
  left on the sand go back into the chest by themselves. On the last page: a **disco ball** — let it go in the water
  and the party starts: the lights dim, deep house plays — builds, drops and all (with sound on — there's a
  nudge if it's off) — the disco ball throws rays, the seaweed turns neon and sways to the beat, and the lights
  pulse in the drops (light-safe). The creatures dance — a little in the build-ups, all-out when the drop hits —
  each in its own style; the Grumpy sulks in the corner (tapping a tentacle when he thinks no one's looking). Drag
  it back to the chest to end it.
- Click the 🔈 button (bottom-right) for sound — it always starts muted.
- Press **D** (dev) or add `?debug` to the URL to see what each creature perceives and feels, plus FPS.
- Add `?seed=42` to revisit a specific world (each visit otherwise gets a random one).
- Honors your OS **reduce motion** setting.

| Command                                   | Purpose                              |
| ----------------------------------------- | ------------------------------------ |
| `pnpm test`                               | Unit tests (Vitest)                  |
| `pnpm typecheck` / `pnpm lint`            | Type-check (`vue-tsc`) / ESLint      |
| `pnpm format:check`                       | Prettier                             |
| `pnpm build`                              | Type-check + production build        |

## How it works

```
pointer ─► input ─► presence ─┐
                              ▼
fixed 60 Hz step: interaction (boop / hold) → perception → mind (emotion → intent) → expression → steering → constraints → animation
                              ▼
     canvas renderer (pure function of state)  ·  audio (observes new emotes & sound events)  ·  Vue (UI only, 5 Hz snapshots)
```

- **Framework-free, deterministic simulation** — plain TypeScript data + functions, seeded RNG, fixed timestep.
  Same seed + same input → identical world, so behavior is unit-tested (scripted cursor paths, not screenshots).
- **Vue 3 as the UI shell only** — the 60 FPS world never touches Vue's reactivity; the debug panel gets throttled
  plain snapshots via `shallowRef`.
- **Canvas 2D, procedural art** — creatures are drawn in code (Bézier tentacles, stateless noise for fur).
- **Behavior** — Reynolds steering behaviors, utility-scored emotions with hysteresis, a `Mind` interface designed
  so an LLM-guided mind could later sit *above* the fast rule-based reflexes. Being held is such a layer: it
  overrides what a creature *does* (a damped spring to your hand, plus a personality-scaled struggle) while its
  feelings keep running underneath.
- **Sound** — Web Audio synthesis (no audio files): pentatonic per-creature voices.

Details: [architecture overview](docs/architecture/overview.md) (the *why*) ·
[code map](docs/architecture/code-map.md) (the *where*, and "to change X, edit Y") · decisions:
[ADR 0001](docs/decisions/0001-vue-as-ui-shell.md) ·
[0002](docs/decisions/0002-framework-free-simulation.md) ·
[0003](docs/decisions/0003-canvas-2d-rendering.md) ·
[0004](docs/decisions/0004-personality-emotion-mind.md)

## How it was built — with Claude Code

This project is also an experiment in **spec-driven development with an AI pair**: I set direction and made the
decisions; [Claude Code](https://claude.com/claude-code) planned, implemented, tested and explained.

- **Persistent project rules** in [`CLAUDE.md`](CLAUDE.md) (working rules, conventions, mentoring style).
- **Reusable workflow skills** in [`.claude/skills/`](.claude/skills/): `plan-task` → `implement-task` →
  `verify-task` → `checkpoint`, plus `adr` for decisions.
- **Every task**: a written spec approved before coding → its own branch → tests + real-browser checks against
  acceptance criteria → a pull request with green CI → merged by me. See the
  [backlog](docs/tasks/backlog.md), the [progress log](docs/progress.md) (including the bugs caught along the way),
  and the [closed PRs](https://github.com/MichaelBeamish/creature-world/pulls?q=is%3Apr+is%3Aclosed).
- `main` is protected: changes land only through PRs with both CI checks green.

## Status & roadmap

The MVP — "The Tide Pool" ([scope & success criteria](docs/product/mvp.md)) — is complete (success criteria 1–5 verified; the informal
first-viewer test is pending), and a sea floor and bubbles have since been added. Now in progress: the **interaction milestone** — boop, drag and
shake → ink (with a reaction per personality) and the treasure chest with shrimp, toys and dress-up are in; glow
sticks and a disco party are next, then petting, names and moving shells — then a public
deploy. Ideas beyond that live in the [roadmap](docs/product/roadmap.md) (social life, an LLM-guided mind, …).
