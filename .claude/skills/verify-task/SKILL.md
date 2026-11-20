---
name: verify-task
description: Verify an implemented task against its acceptance criteria, then update the backlog and progress log. Use after /implement-task, before /checkpoint.
---

# Verify a task

1. Run every check that exists (see Commands in `CLAUDE.md`): tests, type-check, lint, build.
2. Walk through each acceptance criterion and mark it ✅ / ❌ with evidence (test name, command output, or screenshot/visual check).
   - For visual criteria, run the app (use the `run` skill or ask the owner to look) — don't assume.
3. Check `git status`/`git diff` for stray changes outside the task's scope.
4. Report results to the owner honestly, including failures.
5. If everything passes and the owner agrees:
   - Set the task to `done` in `docs/tasks/backlog.md`.
   - Add a dated entry to the top of `docs/progress.md` (what was done, how verified, anything learned).
   - Update `docs/architecture/overview.md` if the structure changed.
6. Suggest `/checkpoint`. Do not commit.
