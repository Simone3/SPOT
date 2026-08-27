---
description: Reconcile docs/technical and CLAUDE.md with the actual state of the code
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(ls:*), Read, Edit, Glob, Grep
---

Check `docs/technical/` and `CLAUDE.md` against the current code and fix any drift.

1. Read `docs/technical/README.md` and the sections the recent work touched, plus `CLAUDE.md`.
2. Compare against reality:
   - §2 Repository map: does every listed file still exist, and is every non-trivial source file listed?
   - §1, §6 and §7: do they match what `src/main` and the renderer write path actually do?
   - §3: does every documented `npm` script still exist in `package.json`?
   - §13: does the described coverage match what is in `tests/`?
   - The index: does it list every file in `docs/technical/`, and does every listed file exist?
3. Fix what is stale. Prefer editing over appending — remove statements that are no longer true rather than layering caveats on them.
4. Keep the two documents non-overlapping: rules live in `CLAUDE.md`, detail lives in `docs/technical/`.

If `$ARGUMENTS` names a specific area, scope the review to it. Report what changed and what you verified as still accurate.
