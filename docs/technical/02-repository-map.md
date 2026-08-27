# §2 — Repository map

*[Index](README.md) · [← §1 Architecture](01-architecture.md)*

Every non-generated file group in the repository and what it is for. Generated folders — `node_modules/`, `build/`, `dist/`, `out/` — are ignored and not listed.

---

## 2.1 Root

| File | Purpose |
| --- | --- |
| `package.json` | Scripts, exact dependency versions, and the `productName` and `version` the packaged application carries |
| `tsconfig.json` | Strict TypeScript, `baseUrl` at the repository root, covering `src` and `tests` — which is what makes `src/...` imports resolve |
| `eslint.config.js` | The flat ESLint configuration used by `npm run lint`, including the rule that keeps `src/framework` from importing application code |
| `vite.config.mts` | The renderer build, the development server's Content-Security-Policy rewrite, and the Vitest configuration, in one file. It is an ES module because `package.json` has no `"type": "module"`, so the `.mts` extension is what keeps the native config loader from treating it as CommonJS |
| `forge.config.js` | Electron Forge: the application identity, the makers, and the fuses applied at package time |
| `index.html` | The renderer's HTML template and the Vite entry point, so it lives in the repository root and loads `src/index.tsx` directly. It carries the strict Content-Security-Policy the built page ships with |
| `CLAUDE.md` | The rules and commands for Claude Code. Keep it aligned with these pages |
| `README.md` | The landing page a user reads: what SPOT is and how to install it, and nothing more |
| `TODO.md` | The outstanding work and the ideas that have not been committed to. Not maintained from here |
| `LICENSE` | Apache License 2.0 |

## 2.2 `src/main` — the Electron main process

| File | Purpose |
| --- | --- |
| `Main.ts` | The composition root, described step by step in [§1.4](01-architecture.md#14-what-the-main-process-does-at-startup) |
| `preload/Preload.ts` | Exposes the five narrow renderer APIs through Electron's context bridge, and nothing else |
| `config/SpotRuntimePaths.ts` | Names the SPOT folders and files and resolves them through the framework runtime paths |
| `config/SpotConfigStore.ts` | Owns the SPOT configuration file shape and exposes the backup folder to the framework backup location manager |
| `config/StartupConfigurationLog.ts` | Writes the one entry describing the run the rest of the operational log belongs to: version, runtime, language, folders, and the settings that decide how the run behaves |
| `ipc/TaskStorageIpc.ts` | Names the SPOT storage IPC channels and hands the task operations to the framework storage command controller |
| `ipc/BackupLocationIpc.ts` | Names the SPOT backup folder channels and the wording of the native folder dialog |
| `ipc/AppInfoIpc.ts` | Answers the renderer's question of which build it is part of |
| `ipc/AppMenuIpc.ts` | Hands the drawn menu bar to the renderer and runs the command of the entry it reports back |
| `ipc/DiagnosticsIpc.ts` | The renderer's one way into the operational log: the task state drift the audit reports and the render error the error boundary caught, answered with the log file it wrote them to |
| `storage/TaskStorage.ts` | Binds the framework storage core to SPOT — the database, the command executor, the task loader and the backup file naming — and defines the SPOT storage contract used by IPC and the renderer |
| `storage/TaskCommandExecutor.ts` | Maps task storage commands to the repository operations and keeps each command inside one transaction |
| `storage/SpotDatabase.ts` | Owns the SPOT schema: the migration list and the `openSpotDatabase()` helper |
| `storage/TaskRepository.ts` | The SQLite task queries, runnable against an existing database wrapper or a short scoped repository session |
| `storage/TaskRowMapping.ts` | Maps between SQLite task rows and React `Task` objects, and owns the shared field-to-column mapping |
| `window/WindowLoadTarget.ts` | Resolves the built `build/index.html` from the Electron app root, and tells from the result whether this is a development run |
| `window/AppMenu.ts` | Builds the native menu SPOT installs, decides whether SPOT draws its own menu bar instead, and describes the bar it draws |
| `window/MenuCommands.ts` | What the entries of that drawn bar do, since they have no Electron role behind them to do it for them |

## 2.3 `src/framework` — the reusable layer

The scaffolding that knows nothing about SPOT, described in [§4](04-framework.md).

| File | Purpose |
| --- | --- |
| `main/logging/AppLogger.ts` | `electron-log` behind a factory, plus the process-wide `appLogger`: newline-delimited JSON, size-based rolling into a caller-chosen number of archives, and writes whose outcome is deliberately not checked |
| `main/logging/ProcessCrashHandlers.ts` | Logs the exceptions and rejected promises nothing else catches, and hands each one to the application to decide what to do about it |
| `main/config/RuntimePaths.ts` | Lays out the application paths inside the Electron user-data folder from caller-supplied names, and gives development runs their own root |
| `main/config/JsonConfigStore.ts` | Reads and writes a JSON configuration file whose shape is decided by a caller-supplied parser |
| `main/config/BackupLocationManager.ts` | Owns the backup folder: startup resolution, validation, the development override, the fallback to the default folder, and persistence |
| `main/storage/AppDatabase.ts` | Opens a SQLite database in write-ahead logging mode, applies caller-supplied migrations, refuses a newer schema, and wraps queries including the backup `VACUUM INTO` |
| `main/storage/DatabaseStorage.ts` | The generic storage core: one lazy connection, record loading, command execution with error classification, operational log writing, backups and shutdown preparation |
| `main/storage/InvalidChangeError.ts` | Marks and recognizes a change the database will never accept, so it is reported as refused instead of retried |
| `main/storage/BackupDirectory.ts` | Validates a backup folder and creates it when it is missing |
| `main/storage/DatabaseBackup.ts` | Writes one rotated backup copy, as described in [§6.4](06-persistence.md#64-backups) |
| `main/storage/BackupScheduler.ts` | Decides when a backup runs: after the changes have settled, once more at shutdown, and never twice at the same time |
| `main/ipc/StorageCommandIpc.ts` | Serializes every storage operation on one chain and owns the shutdown protocol |
| `main/ipc/BackupLocationIpc.ts` | Registers the backup folder IPC surface and opens the native folder dialog with caller-supplied channels and wording |
| `main/window/WindowLoadTarget.ts` | Resolves the built renderer entry file from the application root |
| `main/window/WindowNavigationGuard.ts` | Keeps a window on the page it was loaded with |
| `preload/IpcBridge.ts` | Subscribes the renderer to a main-process channel without exposing the Electron event object |
| `renderer/StorageQueue.ts` | The renderer-side write queue: one command at a time and in order, bounded retries, and unwritable changes reported |
| `renderer/TranslationContext.tsx` | The React provider and hooks for one bundle |
| `renderer/ErrorBoundary.tsx` | Catches the render errors below it and asks the application what to show instead |
| `i18n/Translator.ts` | A translator over one bundle: dotted keys, `{name}` interpolation, plural selection, number formatting and list joining |
| `i18n/LanguageResolution.ts` | Picks the language to run in out of the ones the application ships |
| `types/TranslationTypes.ts` | The translation bundle shape and the typed key union derived from it |
| `types/StorageTypes.ts` | The storage result envelope: statuses, failure reasons, load and command results, operational log entries |
| `types/BackupTypes.ts` | The backup folder contract and the backup file naming shape |
| `utils/ErrorUtils.ts` | Reads a message out of an unknown thrown value |
| `utils/ManuallySortedList.ts` | Inserts, moves and renumbers items carrying a `sortPosition`, with the step supplied by the caller |
| `utils/DateUtils.ts` | Day-granularity comparison and formatting, including the relative labels of [§9.6](09-tasks.md#96-dates) |

## 2.4 `src` — the renderer and the shared code

| Path | Purpose |
| --- | --- |
| `index.tsx` | Mounts React and defines the routes ([§1.3](01-architecture.md#13-the-renderer-tree)) |
| `index.css` | The only global stylesheet: layout and theme variables ([§12](12-styling.md)) |
| `config/AppConfig.ts` | Every app-wide tunable constant, shared by both processes ([§5](05-configuration.md)) |
| `i18n/lang/en.ts` | Every word SPOT shows the user, in English. The source of truth for the translation key type |
| `i18n/Translations.ts` | Lists the languages SPOT ships, resolves one, and creates its translator. Imported by the main process too, so it holds no React and no Electron |
| `i18n/TranslationContext.tsx` | The renderer binding: `TranslationProvider` and `useTranslator` |
| `components/common` | Layout and shared UI primitives, including `AppErrorBoundary.tsx` and the `TitleBar.tsx` / `MenuBar.tsx` pair SPOT draws where the native ones cannot be made to match ([§11.4](11-interface.md#114-common-components)) |
| `components/inputs` | The reusable inputs |
| `components/icons` | Local React icon components |
| `components/tasks` | The task-management UI ([§11.2](11-interface.md#112-the-task-page)) |
| `components/settings` | The Settings route page and the About section that names the running version |
| `components/storage` | The Settings section that explains where the database lives and lets the user choose the backup folder |
| `components/notes`, `components/tags` | Placeholder route pages |
| `contexts` | The app-level React contexts: the backup location and the task state |
| `logic` | State and domain logic — see below |
| `types` | Shared TypeScript types and constants, in semantic files for tasks, task storage, task-storage IPC channels, task audit reports, backup location, backup-location IPC channels, application info, application-info IPC channels, the drawn application menu, application-menu IPC channels, diagnostics, diagnostics IPC channels, domains and filters. The storage and backup types re-export the framework contracts and add only what is specific to SPOT. Types that have one clear owner stay in the owning `.ts` or `.tsx` file instead |
| `types/ElectronSquirrelStartup.d.ts` | Declares the one boolean `electron-squirrel-startup` exports, because the package ships no types of its own and a dependency for a single boolean would be more to keep up to date than it is worth |
| `vite-env.d.ts` | The Vite client reference declaring the CSS and asset imports, plus the renderer-side declarations of `window.spotStorage`, `window.spotBackupLocation`, `window.spotAppInfo`, `window.spotAppMenu` and `window.spotDiagnostics` |

`src/logic` in detail:

| File | Purpose |
| --- | --- |
| `TaskStateLogic.ts` | The task state container and every update over it ([§9.2](09-tasks.md#92-the-task-state)) |
| `TasksLogic.ts` | Task-level operations, including the forced importance sort |
| `FiltersLogic.ts` | What makes a task visible ([§9.3](09-tasks.md#93-filtering)) |
| `DomainsLogic.ts` | The option domains for filters and form inputs ([§9.4](09-tasks.md#94-domains)) |
| `TaskComparison.ts` | What a stored task is, and how two of them are compared |
| `PendingTaskChanges.ts` | The task edits the user has not saved yet ([§7.3](07-task-write-path.md#73-buffered-task-changes)) |
| `TaskStorageQueue.ts` | Creates the single renderer write queue from the framework and exposes it to the task components |
| `TaskStateAudit.ts` | Compares the tasks React holds against the tasks read back from the database ([§7.4](07-task-write-path.md#74-auditing-the-task-state)) |
| `Diagnostics.ts` | The renderer's only caller of the diagnostics bridge |
| `AppMenu.ts` | Its only caller of the application menu bridge |
| `PaneLayout.ts` | The width the user gave each resizable pane, and the rules that width has to obey ([§11.5](11-interface.md#115-resizable-panes)) |

## 2.5 `tests`

`tests/framework` holds the tests for `src/framework` and depends only on framework modules, so they travel with the folder. `tests/main`, `tests/logic` and `tests/components` hold the SPOT tests, `tests/testUtils` the shared factories, and `tests/setupTests.ts` the shared setup. [§13](13-testing.md) describes all of it.

## 2.6 `scripts`

| File | Purpose |
| --- | --- |
| `build-electron.js` | Bundles the Electron main and preload TypeScript sources into the ignored `dist/electron` runtime files |
| `electron-bundle.js` | The one esbuild description of that bundle, shared by the one-shot build and the watching development loop, so a development run never runs through a different bundle than the built one |
| `dev.js` | The hot-reloading development loop of [§3.4](03-build-and-run.md#34-the-development-loop) |
| `build-icons.js` | Regenerates the packaged application icons from `assets/icon.svg` ([§3.7](03-build-and-run.md#37-icons)) |

## 2.7 Everything else

- `assets/` holds `icon.svg`, the only hand-edited icon file, and the generated `icon.icns`, `icon.ico` and `icon.png` that Electron Forge packages. They are committed, so packaging never depends on regenerating them, and the folder is tracked because `build` and `dist` are both ignored.
- `docs/technical/` is this documentation set.
- `.github/workflows/release.yml` builds the installers of one release on all three operating systems and drafts the GitHub release ([§3.8](03-build-and-run.md#38-releasing)).
- `.claude/` holds the Claude Code configuration: shared tool permissions and the repeatable slash commands.

---

[← §1 Architecture](01-architecture.md) · [§3 Build and run →](03-build-and-run.md)
