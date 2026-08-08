# CLAUDE.md

Instructions for Claude Code when working in this repository.

`DOCUMENTATION.md` is the detailed project reference: architecture, persistence contract, data model, UI structure, and testing scope. Read the relevant section of it before changing code in an area you have not touched yet in the current session. This file holds only the rules and commands; the reasoning behind them lives there.

## Project

SPOT (Simple Planner & Organizer Tool) is an Electron + React task manager for macOS, Windows, and Linux, meant to manage tasks in a simple and direct way (no frills). Tasks are the finished surface; the Notes and Tags routes hold placeholder pages and are not linked from the sidebar. Standalone browser mode is not a supported runtime.

## Commands

```sh
npm run lint           # ESLint flat config (eslint.config.js)
npm run typecheck      # tsc --noEmit
npm test               # Vitest, tests/ only
npm start              # hot-reloading loop: Vite dev server for the renderer, watched Electron bundles that relaunch the app
npm run start-packaged # build React + Electron bundles once, then electron-forge start
npm run build          # build-react + build-electron
npm run build-icons    # regenerate assets/icon.{icns,ico,png} from assets/icon.svg
```

Prefer running a single test file while iterating:

```sh
npm test -- tests/logic/SomeFile.test.ts
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
- A packaged run always loads the renderer from the built `build/index.html` on disk. The development server URL is read from the environment, so it must never be honoured when `app.isPackaged`: anything able to set an environment variable would otherwise put a page of its own choosing behind the preload bridge. The strict Content-Security-Policy in `index.html` is relaxed for the development server's page only, never for the built one.
- `src/framework` is reusable scaffolding meant to be lifted into another application as it is. It must NEVER import from `src/components`, `src/contexts`, `src/logic`, `src/main`, `src/types`, `src/utils`, or `src/config`. Anything it needs about SPOT is passed in through its options. ESLint enforces this.

## Code Conventions

- Use absolute imports rooted at `src/...` for in-repository React sources and assets, including CSS. Never relative `./` or `../`.
- Define TypeScript types in the owning `.ts`/`.tsx` file whenever practical. Shared cross-owner types live under `src/types` in semantic files such as `TaskTypes.ts`, `DomainTypes.ts`, `FilterTypes.ts`.
- Prefer existing project patterns over new abstractions, but do centralize behavior into shared components/utilities when convenient.
- Tunable constants (sizes, delays, retry policies, file and directory names) belong in `src/config/AppConfig.ts`, not inline in modules.
- Anything the user can click is a real control and not a clickable `div`, so the keyboard reaches it and activates it. Every focusable control shows the one focus ring `src/index.css` applies to `:focus-visible`, and never a focus style of its own: a control that has to draw its own must override that rule and say why. Give the ring room where something would clip it instead of dropping it.
- Every string the user can read belongs in the translation bundle at `src/i18n/lang/en.ts`, never inline in a component. Components reach it through `useTranslator()`; pure logic and the Electron main process take a translator, or just the labels they need, as a parameter. Developer-facing strings (log messages, `console` output, errors only a bug can raise) stay in the module that owns them and stay in English.
- Use a plural translation entry rather than comparing a count against 1, and interpolate values through `{name}` placeholders rather than string concatenation, so number formatting and plural rules follow the language.
- `src/framework` takes SPOT's configuration values and its user-facing wording as parameters instead of reading `AppConfig` or owning text, the way `DateUtils` takes its date labels and `BackupDirectory` takes its refusal messages. It holds no module-level state, so everything is created by a factory; the process-wide `appLogger` and the pure `Intl` memoization caches are the only exceptions. Put new code there only when it would be just as useful to a different application, and in SPOT otherwise: moving it later is easy, untangling it is not.
- Match the existing code style exactly, including spacing and newline conventions. Read a neighboring file before writing a new one.
- Preserve the storage command names: `task.create`, `task.update`, `task.delete`, `tasks.updateMany`.
- The task state audit only reads. It reports what the task state and the database disagree on and never writes either one over the other. It must also never run while the pending-changes buffer or the write queue still holds something. What it finds has to reach the operational log through `spotDiagnostics` and the notice has to name that file: an installed SPOT has no developer console, and a drift nobody can look into afterwards is not reported at all. `src/logic/Diagnostics.ts` is the only renderer module that touches that bridge, and the main process, not the renderer, decides what each entry says and how large it may get.
- Database failures are user-facing: surface task-save feedback on write failure and reconcile state. Operational-log failures are best-effort and ignored by React when SQLite succeeds. Backup failures are user-facing too, but as a soft notice, and must never be routed through the database error path: the tasks are already saved locally.
- The live `spot.sqlite` database always lives in the Electron user-data folder and never moves. Configuration and log files stay there too, and development runs keep their own root folder there. The user-selected folder only receives rotated write-only backup copies.
- Never place the live database in a folder a synchronization client controls, and never copy it with a plain file copy: build backups with `VACUUM INTO` locally, then publish them with an atomic rename.
- Only one SPOT process may run at a time. `Main.ts` turns away the Windows installer's own launches and then takes the single instance lock before anything else, and nothing may assume a second process could share the database.
- Failures that reach the top of the main process must leave a trace and, once the language is resolved, reach the user. A render error must not empty the window, and must reach the operational log through `spotDiagnostics`: the renderer console is developer-facing and an installed SPOT cannot open it. Neither path may be removed without replacing it: a silent failure in a released build is unreportable.
- `productName` in `package.json` and `packagerConfig.appBundleId` in `forge.config.js` are fixed now that SPOT is installed: the user-data folder holding the live database is named after `productName`, and macOS keeps permissions and window state under the bundle identifier. The makers must keep naming the same executable.
- The application menu must always offer the Edit submenu, because on macOS the standard editing shortcuts are its accelerators. An installed SPOT must offer no reload or developer tools entry; only a development run keeps the menu Electron installs by itself.
- Where SPOT draws the menu bar itself, the native menu stays installed and only its bar is hidden: the accelerators belong to its Electron roles, and removing it takes every shortcut with it. The drawn bar therefore repeats the shortcut text and must keep saying what those roles actually listen for. Its entries never take the focus, because the editing ones act on the field the user was typing in.
- Anything the renderer can ask the main process to do through the menu bridge is a name from `SPOT_MENU_COMMANDS` and nothing else. An unknown name is ignored, never guessed at.

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
