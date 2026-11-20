---
name: implement-task
description: Implement one approved, planned backlog task in small steps following CLAUDE.md conventions. Use after /plan-task has been approved.
---

# Implement a task

1. Confirm the task is `planned` and its spec was approved in this conversation. If not, run `/plan-task` first.
2. Set the task status to `in-progress` in `docs/tasks/backlog.md`.
3. Implement in small steps; after each meaningful step, run the relevant tests/type-check.
   - Write simulation tests alongside the code (seeded RNG, fixed `dt`).
   - Respect layer rules: no DOM/Vue in `src/simulation/`; rendering never mutates state.
4. Stay inside the spec. If something outside it is needed (new dependency, design change, extra scope), stop and ask.
5. Briefly explain notable techniques or modern practices used, for the owner's learning.
6. When done, hand off to `/verify-task`. Do not commit.
