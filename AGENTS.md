
## Recap
- The goal is to have an Electron + React application that runs on Mac / Windows / Linux to manage tasks in a simple and direct way (no frills).
- The app is still work in progress. The React renderer is considered done for now, standalone browser mode is not a supported runtime, and the initial Electron / database persistence layer is wired for startup loading, task mutations, shutdown draining, and packaged loading.

## Core Constraints
- Work only in this repository and only on the current branch.
- `README.md` just contains minimal information about the application and how to run it.
- `DOCUMENTATION.md` contains the detailed application documentation.
- Keep `AGENTS.md` and `DOCUMENTATION.md` aligned and up to date. If either becomes stale or contradicts the project state, fix it as part of the task.
- Do NOT edit `TODO.md` and `README.md`.
- Do NOT introduce extra libraries unless you justify them briefly and they clearly reduce work or risk.
- `package.json` dependencies must always use exact versions; do not use modifiers such as `^` or `~`.
- Prefer existing project patterns over new abstractions when they are available. However, do centralize behavior into shared components/utilities whenever convenient.
- Use absolute imports from `src/...` for in-repository React source files and assets instead of relative `./` or `../` imports.
- Define TypeScript types in the owning `.ts`/`.tsx` file whenever practical. Shared cross-owner types live under `src/types` in semantic files such as `TaskTypes.ts`, `DomainTypes.ts`, or `FilterTypes.ts`.
- Use plain React with TypeScript and CSS only. Do not add frameworks such as Vite or Next.js.
- Keep the code style consistent with the existing codebase, including spacing and newline conventions.
- `eslint.config.js` contains the flat ESLint configuration used by `npm run lint`.

## Testing And Validation
- Testing should stay minimal but meaningful: focused unit tests for important logic plus at least 1-2 smoke tests for critical user flows.
- All relevant checks must pass before closing a feature or fix:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`

## Persistence Work Rules
- The persistence contract in `DOCUMENTATION.md` is the source of truth for the initial storage implementation.
- Preserve the initial command names: `task.create`, `task.update`, `task.delete`, and `tasks.updateMany`.
- Expose database health to React. Database failures are user-facing, include task-save feedback when writes fail, and require state reconciliation; operational-log failures are optional, best-effort, and ignored by React when SQLite succeeds.
- Runtime persistence is wired for Electron startup and task mutations. Electron registers storage IPC handlers through `src/main/ipc/TaskStorageIpc.ts`, the bundled preload from `src/main/preload/Preload.ts` exposes them as `window.spotStorage`, and React requires that API for task loading and mutations. Browser-only sample-data/local mutation code has been removed.
- Electron main and preload TypeScript sources are bundled through `scripts/build-electron.js` into ignored `dist/electron` files. The project uses exact-version `esbuild` for that Electron build step so main/preload code can use TypeScript and `src/...` imports without a custom runtime resolver.
- Electron loads the built React `build/index.html` file in both development and packaged mode. `npm start`, `npm run package`, and `npm run make` build the React renderer and Electron bundles first, and CRA uses `homepage: "."` so packaged assets resolve from the file-loaded build.
- The first SQLite implementation uses Electron's bundled Node `node:sqlite` support. Do not add an external SQLite dependency unless the reason is documented in `DOCUMENTATION.md`.
- `src/main/Main.ts` initializes the process-wide `spotLogger` as soon as Electron is ready and the user-data storage path is available. `createTaskStorage({ storageDirectory })` can load and mutate persisted task rows through one lazy storage-owned SQLite connection, write the optional operational log through that process logger, and close the database through `prepareForShutdown()` for tests and the current IPC boundary. Electron shutdown drains in-flight task commands, flushes pending log retry attempts, and rejects new write commands after shutdown begins. React startup is wired to `loadTasks()` in Electron, and React task mutations are wired to `executeTaskCommand()`.

## Delivery Rules
- You MUST commit the code when you complete any task.
- Every commit message must start with `Codex: `.
- Leave ignored files and `.gitignore` patterns alone.
