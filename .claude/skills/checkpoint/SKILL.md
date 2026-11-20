---
name: checkpoint
description: Propose a git commit for verified work and create it only after the owner explicitly approves. Use after /verify-task, or when the owner asks to checkpoint.
---

# Checkpoint (git commit)

1. Run `git status` and `git diff --stat`. Make sure no secrets, build output, or unrelated files are included.
2. Propose:
   - The exact files to stage.
   - A Conventional Commit message, e.g. `feat(simulation): add seeded world step` (types: feat, fix, docs, test, refactor, chore).
3. **Ask the owner for approval and wait.** Never commit without an explicit "yes" in this conversation.
4. On approval: stage only those files, commit, and show `git log --oneline -1`.
5. Never push, amend, force, or skip hooks unless the owner explicitly asks.
