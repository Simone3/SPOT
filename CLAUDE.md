# CLAUDE.md

Instructions for Claude Code when working in this repository.

`DOCUMENTATION.md` is the detailed project reference: architecture, persistence contract, data model, UI structure, and testing scope. Read the relevant section of it before changing code in an area you have not touched yet in the current session. This file holds only the rules and commands.

## Project

SPOT (Simple Planner & Organizer Tool) is an Electron + React task manager for macOS, Windows, and Linux, meant to manage tasks in a simple and direct way (no frills). Work in progress: the React renderer is considered done for now, and the Electron persistence layer is wired for startup loading, task mutations, shutdown draining, packaged loading, and rotated backups into the user-selected backup folder. Standalone browser mode is not a supported runtime.

## Commands

```sh
npm run lint        # ESLint flat config (eslint.config.js)
npm run typecheck   # tsc --noEmit
npm test            # Jest via react-scripts, tests/ only
npm start           # build React + Electron bundles, then electron-forge start
npm run build       # build-react + build-electron
```

Prefer running a single test file while iterating:

```sh
npm test -- tests/logic/SomeFile.spec.ts
```

## Hard Rules

- Work only in this repository and only on the current branch.
- Do NOT edit `TODO.md` or `README.md`. `README.md` stays minimal.
- Keep `CLAUDE.md` and `DOCUMENTATION.md` aligned and up to date. If either becomes stale or contradicts the project state, fix it as part of the task.
- Do NOT introduce extra libraries unless you justify them briefly and they clearly reduce work or risk.
- `package.json` dependencies must use exact versions. No `^` or `~`.
- Do not add frameworks such as Vite or Next.js. Plain React + TypeScript + CSS only.
- Leave ignored files and `.gitignore` patterns alone.
- Do not add an external SQLite dependency. The implementation uses Electron's bundled `node:sqlite`; any exception must be documented in `DOCUMENTATION.md`.

## Code Conventions

- Use absolute imports rooted at `src/...` for in-repository React sources and assets, including CSS. Never relative `./` or `../`.
- Define TypeScript types in the owning `.ts`/`.tsx` file whenever practical. Shared cross-owner types live under `src/types` in semantic files such as `TaskTypes.ts`, `DomainTypes.ts`, `FilterTypes.ts`.
- Prefer existing project patterns over new abstractions, but do centralize behavior into shared components/utilities when convenient.
- Tunable constants (sizes, delays, retry policies, file and directory names) belong in `src/config/AppConfig.ts`, not inline in modules. Message strings stay in the module that owns them.
- Match the existing code style exactly, including spacing and newline conventions. Read a neighboring file before writing a new one.
- Preserve the storage command names: `task.create`, `task.update`, `task.delete`, `tasks.updateMany`.
- Database failures are user-facing: surface task-save feedback on write failure and reconcile state. Operational-log failures are best-effort and ignored by React when SQLite succeeds. Backup failures are user-facing too, but as a soft notice: they must never be routed through the database error path, because the tasks are already saved locally.
- The live `spot.sqlite` database always lives in the Electron user-data folder and never moves. The user-selected folder only receives rotated write-only backup copies; SPOT never reads them back and does not sync across devices. Configuration and log files also stay in the user-data folder, and development runs keep their own root folder there.
- Never place the live database in a folder a synchronization client controls, and never copy it with a plain file copy: build backups with `VACUUM INTO` locally, then publish them with an atomic rename.

## Testing

Testing stays minimal but meaningful: focused unit tests for important logic plus 1-2 smoke tests for critical user flows. New logic in `src/logic`, `src/utils`, and `src/main/storage` should come with unit tests.

All three checks must pass before a feature or fix is considered done:

```sh
npm run lint && npm run typecheck && npm test
```

## Workflow

1. For a non-trivial change, read the relevant `DOCUMENTATION.md` section first.
2. Implement, following the conventions above.
3. Run lint, typecheck, and tests. Fix what breaks.
4. Update `DOCUMENTATION.md` if behavior, architecture, or repository structure changed.
5. Commit. Every commit message starts with `Claude: ` followed by an imperative summary, e.g. `Claude: Drain storage commands on shutdown`.

Commit when a task is complete. Do not amend or rewrite existing commits, and do not push unless asked.
