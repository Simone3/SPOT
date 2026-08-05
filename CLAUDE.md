# CLAUDE.md

Instructions for Claude Code when working in this repository.

`DOCUMENTATION.md` is the detailed project reference: architecture, persistence contract, data model, UI structure, and testing scope. Read the relevant section of it before changing code in an area you have not touched yet in the current session. This file holds only the rules and commands.

## Project

SPOT (Simple Planner & Organizer Tool) is an Electron + React task manager for macOS, Windows, and Linux, meant to manage tasks in a simple and direct way (no frills). Work in progress: the React renderer is considered done for now, and the Electron persistence layer is wired for startup loading, task mutations, shutdown draining, packaged loading, and rotated backups into the user-selected backup folder. Standalone browser mode is not a supported runtime.

## Commands

```sh
npm run lint        # ESLint flat config (eslint.config.js)
npm run typecheck   # tsc --noEmit
npm test            # Vitest, tests/ only
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
- Build and test tooling may own the build: Vite bundles the renderer and Vitest runs the tests. Do NOT add an application framework such as Next.js, Remix or Astro: nothing may own routing, rendering or the component model. The application code stays plain React + TypeScript + CSS.
- Leave ignored files and `.gitignore` patterns alone.
- Do not add an external SQLite dependency. The implementation uses Electron's bundled `node:sqlite`; any exception must be documented in `DOCUMENTATION.md`.
- `src/framework` is reusable scaffolding meant to be lifted into another application as it is. It must NEVER import from `src/components`, `src/contexts`, `src/logic`, `src/main`, `src/types`, `src/utils`, or `src/config`. Anything it needs about SPOT is passed in through its options. ESLint enforces this.

## Code Conventions

- Use absolute imports rooted at `src/...` for in-repository React sources and assets, including CSS. Never relative `./` or `../`.
- Define TypeScript types in the owning `.ts`/`.tsx` file whenever practical. Shared cross-owner types live under `src/types` in semantic files such as `TaskTypes.ts`, `DomainTypes.ts`, `FilterTypes.ts`.
- Prefer existing project patterns over new abstractions, but do centralize behavior into shared components/utilities when convenient.
- Tunable constants (sizes, delays, retry policies, file and directory names) belong in `src/config/AppConfig.ts`, not inline in modules. Message strings stay in the module that owns them.
- `src/framework` never reads `AppConfig`: it takes those values as parameters, and the SPOT adapters pass them in. It holds no module-level state either, so everything is created by a factory. Two exceptions: the process-wide `appLogger`, which the application initializes once at startup, and pure memoization caches such as the ones in `DateUtils`, which no caller can observe through.
- Put new code in `src/framework` only when it would be just as useful to a different application, and in SPOT otherwise. When in doubt, put it in SPOT: moving it later is easy, untangling it is not.
- Match the existing code style exactly, including spacing and newline conventions. Read a neighboring file before writing a new one.
- Preserve the storage command names: `task.create`, `task.update`, `task.delete`, `tasks.updateMany`.
- Database failures are user-facing: surface task-save feedback on write failure and reconcile state. Operational-log failures are best-effort and ignored by React when SQLite succeeds. Backup failures are user-facing too, but as a soft notice: they must never be routed through the database error path, because the tasks are already saved locally.
- The live `spot.sqlite` database always lives in the Electron user-data folder and never moves. The user-selected folder only receives rotated write-only backup copies; SPOT never reads them back and does not sync across devices. Configuration and log files also stay in the user-data folder, and development runs keep their own root folder there.
- Never place the live database in a folder a synchronization client controls, and never copy it with a plain file copy: build backups with `VACUUM INTO` locally, then publish them with an atomic rename.

## Testing

Testing stays minimal but meaningful: focused unit tests for important logic plus 1-2 smoke tests for critical user flows. New logic in `src/logic`, `src/main/storage`, and `src/framework` should come with unit tests.

Tests for `src/framework` live in `tests/framework` and must depend only on framework modules, so they travel with the folder. SPOT tests live in `tests/main`, `tests/logic`, and `tests/components`.

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
