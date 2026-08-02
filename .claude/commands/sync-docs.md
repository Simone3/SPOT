---
description: Reconcile DOCUMENTATION.md and CLAUDE.md with the actual state of the code
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(ls:*), Read, Edit, Glob, Grep
---

Check `DOCUMENTATION.md` and `CLAUDE.md` against the current code and fix any drift.

1. Read both documents.
2. Compare against reality:
   - Repository Map: does every listed file still exist, and is every non-trivial source file listed?
   - Current Status and the persistence sections: do they match what `src/main` actually does?
   - Commands: does every documented `npm` script still exist in `package.json`?
   - Testing: does the described coverage match what is in `tests/`?
3. Fix what is stale. Prefer editing over appending — remove statements that are no longer true rather than layering caveats on them.
4. Keep the two documents non-overlapping: rules live in `CLAUDE.md`, detail lives in `DOCUMENTATION.md`.

If `$ARGUMENTS` names a specific area, scope the review to it. Report what changed and what you verified as still accurate.
