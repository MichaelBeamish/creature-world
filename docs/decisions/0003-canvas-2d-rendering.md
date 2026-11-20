# 0003 — Canvas 2D for procedural rendering

- **Status:** Accepted
- **Date:** 2026-11-20

## Context
Creatures are soft, procedurally drawn shapes (blob bodies, wobbly tentacles, fuzzy edges) and there are only 3–5 of them.

## Decision
Render with the Canvas 2D API on a single full-viewport, devicePixelRatio-aware canvas. No rendering library.

## Consequences
- ➕ Zero dependencies, simple mental model, great for curves and soft shapes.
- ➕ Easy to draw debug overlays in the same pass.
- ➖ Fur/glow effects must be approximated (layered strokes, gradients); heavy filters can be slow.
- **Revisit** (new ADR) if profiling shows < 55 FPS at MVP scale, or for many creatures/particles → PixiJS (WebGL).
