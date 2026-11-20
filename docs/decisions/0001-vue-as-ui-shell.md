# 0001 — Vue 3 + Vite + TypeScript, with Vue as the UI shell only

- **Status:** Accepted
- **Date:** 2026-11-20

## Context
The owner knows Vue and wants to relearn modern tooling. The core of the app is a 60 FPS animated world,
which is a poor fit for component re-rendering or deep reactivity.

## Decision
Use Vite + TypeScript (strict) + Vue 3 `<script setup>`. Vue renders only the overlay UI
(mute toggle, debug panel, later a chat panel). The world is drawn on a single `<canvas>` by plain TS code.

## Consequences
- ➕ Familiar framework; modern tooling learned in context; room for richer UI later.
- ➕ Simulation and rendering stay framework-independent and fast.
- ➖ Two "worlds" to bridge: Vue receives throttled snapshots, never per-frame state.
- Alternative considered: no framework (vanilla TS). Lighter, but less learning value and harder to grow the UI.
