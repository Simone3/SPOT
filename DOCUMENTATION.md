# SPOT Documentation

SPOT is the Simple Planner & Organizer Tool: a small Electron + React task manager for macOS, Windows, and Linux, meant to manage tasks in a simple and direct way. Tasks are the finished surface; Notes and Tags are routes that exist but hold placeholder pages.

Its persistence is one local SQLite database as the source of truth, one append-only rolled `spot-logs.ndjson` operational log beside it, and a rotated set of backup copies in a folder the user chooses. Electron owns all three. Standalone browser mode is not a supported runtime: the renderer requires the preload bridge and reports storage as unavailable without it.

What is worth knowing before changing anything: task writes are optimistic and queued, the database never moves, and a quit is a handshake rather than an exit. The Persistence sections below describe each of those.

## How To Run

Node 24 or later is required, as declared by the `engines.node` field in `package.json`. That floor matches the Node version Electron bundles, so the main process is developed and tested against the runtime it actually ships on. It also clears the minimums that Electron itself, `@electron/fuses`, and `@testing-library/jest-dom` declare.

Install dependencies:

```sh
npm install
```

Run the Electron app with hot reloading, as described in the Development Loop section:

```sh
npm start
```

Run it the way a packaged one runs instead, from files built once:

```sh
npm run start-packaged
```

Run validation:

```sh
npm run lint
npm run typecheck
npm test
```

Build and package commands also exist:

```sh
npm run build
npm run build-react
npm run build-electron
npm run package
npm run make
```

`npm run start-packaged`, `npm run package`, and `npm run make` build the React renderer and Electron main/preload bundles first so Electron always loads local generated files.

Regenerating the application icons is a separate step, because their generated files are committed:

```sh
npm run build-icons
```

## Development Loop

`npm start` runs `scripts/dev.js`, which is the loop to work in. `npm run start-packaged` is the other run: it builds everything once and starts the application from those files, so it shows what a packaged SPOT does but reflects no source change until it is started again.

The loop does this:

- It starts a Vite development server through Vite's programmatic API and lets it pick its own port, so nothing has to agree on a port number in advance.
- It passes the URL that server reported to Electron in the `SPOT_DEVELOPMENT_SERVER_URL` environment variable, named by `WINDOW_CONFIG.developmentServerUrlVariable`. `resolveWindowLoadTarget()` turns that into a `url` load target, and `Main.ts` loads it with `loadURL()` instead of `loadFile()`. A renderer edit is then hot-reloaded by Vite in place, and React Fast Refresh keeps component state across it.
- It builds the Electron main and preload bundles with a watching `esbuild` context, and relaunches Electron after every successful rebuild. A rebuild that failed leaves the running application alone, because relaunching into a bundle that does not exist would only replace the error with a second one.
- Electron is spawned directly from the `electron` package rather than through `electron-forge start`, so a relaunch costs no more than the process restart. Forge stays the entry point of `npm run start-packaged`, `npm run package`, and `npm run make`, whose plugins all run at package time.
- Closing the application stops the loop, and stopping the loop closes the application, the development server, and the esbuild watcher.

Two consequences worth knowing:

- A main-process relaunch kills the running process, so the shutdown drain and the renderer flush handshake do not run: task changes still buffered in the renderer are lost. Renderer edits are unaffected, because they never restart the process.
- The relaunch waits for the old process to be gone before spawning the new one. It has to: the single instance lock in `Main.ts` would make the new process quit immediately otherwise.

`scripts/electron-bundle.js` holds the one esbuild description that both `scripts/build-electron.js` and `scripts/dev.js` use, so a development run never runs through a different bundle than the built one.

The renderer's strict Content-Security-Policy in `index.html` cannot be satisfied by a development server: React Fast Refresh installs its runtime through an inline module script, and the hot update channel is a WebSocket back to the server. The `spot-development-content-security-policy` plugin in `vite.config.mts` rewrites the two policy meta tags for the served page only, allowing inline scripts and a WebSocket connection to the local server, and it throws if it finds no policy to rewrite so the two files cannot drift apart unnoticed. The built `index.html` keeps the strict policy it is packaged with, which is also why a packaged run ignores the environment variable entirely: honouring it there would let anything that can set an environment variable put a page of its own choosing behind the preload bridge.

## Repository Map

- `CLAUDE.md` contains contributor and coding-agent instructions. Keep it aligned with this document.
- `.claude/` contains Claude Code configuration: shared tool permissions and repeatable slash commands.
- `README.md` intentionally stays minimal.
- `DOCUMENTATION.md` is this detailed project reference.
- `eslint.config.js` contains the flat ESLint configuration used by `npm run lint`.
- `scripts/build-electron.js` bundles Electron main and preload TypeScript sources into ignored `dist/electron` runtime files.
- `scripts/electron-bundle.js` holds the esbuild description of that bundle, shared by the one-shot build and the watching development loop.
- `scripts/dev.js` runs the hot-reloading development loop described in the Development Loop section.
- `scripts/build-icons.js` regenerates the packaged application icons from `assets/icon.svg`, as described in the Application Icon section.
- `assets/icon.svg` is the application icon master artwork, and `assets/icon.icns`, `assets/icon.ico`, and `assets/icon.png` are the generated files Electron Forge packages. They are committed, so packaging never depends on regenerating them. The folder is tracked because `build` and `dist` are both ignored.
- `vite.config.mts` configures the Vite renderer build, the development server's Content-Security-Policy, and the Vitest test run. It is an ES module because `package.json` has no `"type": "module"`, so the `.mts` extension is what keeps the native config loader from treating it as CommonJS.
- `index.html` is the React renderer HTML template and the Vite entry point, so it lives in the repository root and loads `src/index.tsx` directly.
- `src/index.tsx` mounts the React app and defines routes.
- `src/index.css` defines global layout and theme variables.
- `src/config/AppConfig.ts` holds the app-wide configuration constants shared by the Electron main process and the React renderer.
- `src/i18n/lang/en.ts` holds every word SPOT shows the user, in English. It is the source of truth for the translation key type.
- `src/i18n/Translations.ts` lists the languages SPOT ships, resolves one, and creates its translator. It is imported by the Electron main process as well as the renderer, so it holds no React and no Electron.
- `src/i18n/TranslationContext.tsx` is the renderer binding: the `TranslationProvider` mounted at the top of the tree and the `useTranslator` hook every component that shows text reads.
- `src/main/Main.ts` handles the Windows installer's own launches, takes the single instance lock, installs the process crash handlers, resolves the runtime paths, initializes the process-wide logger, creates the task storage, registers IPC handlers, creates the backup scheduler, resolves the backup folder, and creates the Electron `BrowserWindow` that loads the built React renderer behind a navigation guard.
- `src/main/preload/Preload.ts` exposes the narrow renderer APIs through Electron's context bridge.
- `src/framework` contains the reusable application scaffolding described in the Framework Layer section below. It never imports SPOT code.
- `src/framework/utils/ErrorUtils.ts` reads a message out of an unknown thrown value.
- `src/framework/utils/ManuallySortedList.ts` inserts, moves, and renumbers items that carry a `sortPosition`, with the position step supplied by the caller.
- `src/framework/utils/DateUtils.ts` compares and formats dates at day granularity, including the relative day labels described in the Dates section.
- `src/framework/i18n/Translator.ts` creates a translator over one translation bundle: dotted key lookup, `{name}` interpolation, `Intl.PluralRules` plural selection, locale number formatting, and `Intl.ListFormat` list joining.
- `src/framework/i18n/LanguageResolution.ts` picks the language to run in out of the ones the application ships, falling a regional tag back to its base language.
- `src/framework/renderer/TranslationContext.tsx` creates the React provider and hooks for one bundle, so the whole UI re-renders when the language changes.
- `src/framework/renderer/ErrorBoundary.tsx` catches the render errors below it and asks the application what to show instead, so a component that throws does not leave an empty window.
- `src/framework/types/TranslationTypes.ts` owns the translation bundle shape and derives the typed key union from it.
- `src/framework/types/StorageTypes.ts` owns the storage result envelope: database and backup status, failure reasons, load and command results, and operational log entries.
- `src/framework/types/BackupTypes.ts` owns the backup folder contract and the backup file naming shape.
- `src/framework/main/logging/AppLogger.ts` configures `electron-log` behind a factory-created logger and exports the process-wide `appLogger` utility with `info`, `warn`, `error`, `debug`, and `flush` methods, newline-delimited JSON output, size-based rolling into a caller-chosen number of numbered archives, and writes whose outcome is deliberately not checked.
- `src/framework/main/logging/ProcessCrashHandlers.ts` logs the exceptions and rejected promises nothing else catches, and hands each one to the application to decide what to do about it.
- `src/framework/main/config/RuntimePaths.ts` lays out the application paths inside the Electron user-data folder from a caller-supplied set of folder and file names, and gives development runs their own root folder.
- `src/framework/main/config/JsonConfigStore.ts` reads and writes a JSON configuration file whose shape is decided by a caller-supplied parser.
- `src/framework/main/config/BackupLocationManager.ts` owns the backup folder: startup resolution, validation, the development override, the fallback to the default folder, and persistence through a caller-supplied directory store.
- `src/framework/main/storage/AppDatabase.ts` opens a SQLite database in write-ahead logging mode, applies caller-supplied migrations in ascending version order, refuses a database written by a newer schema, exposes a small query wrapper including the backup `VACUUM INTO` helper, and emits SQL query log records through the process-wide logger.
- `src/framework/main/storage/DatabaseStorage.ts` is the generic storage core: one lazy database connection, record loading, command execution with database-error and refused-command classification, operational log writing, backup execution and backup status, and shutdown preparation.
- `src/framework/main/storage/InvalidChangeError.ts` marks and recognizes a change the database will never accept, so it is reported as refused instead of retried.
- `src/framework/main/storage/BackupDirectory.ts` validates a backup folder and creates it when it is missing.
- `src/framework/main/storage/DatabaseBackup.ts` writes one rotated backup copy: `VACUUM INTO` a local temporary file, publish it into the backup folder through a partial file and an atomic rename, then prune the folder down to the retained backup count.
- `src/framework/main/storage/BackupScheduler.ts` decides when a backup runs: after the changes have settled, once more at shutdown under a bounded timeout, and never twice at the same time.
- `src/framework/main/ipc/StorageCommandIpc.ts` serializes every storage operation on one chain and owns the shutdown protocol: the `before-quit` handshake with the renderer, the hook that tells the application to stop collecting changes before the first command is refused, the drain of in-flight commands, the pre-close backup hook, and the exclusive-access helper.
- `src/framework/main/ipc/BackupLocationIpc.ts` registers the backup folder IPC surface and opens the native folder dialog with caller-supplied channel names and wording.
- `src/framework/main/window/WindowLoadTarget.ts` resolves the built renderer entry file from the application root.
- `src/framework/main/window/WindowNavigationGuard.ts` keeps a window on the page it was loaded with: it denies every window the page tries to open and prevents every whole-page navigation somewhere else.
- `src/framework/preload/IpcBridge.ts` subscribes the renderer to a main-process channel without exposing the Electron event object.
- `src/framework/renderer/StorageQueue.ts` creates a renderer-side write queue: commands are written one at a time and in order, failed writes are retried a bounded number of times, changes that can never be written are reported, and callers can either wait for everything to be written or ask whether it already has been.
- `src/main/config/SpotRuntimePaths.ts` names the SPOT folders and files and resolves them through the framework runtime paths.
- `src/main/config/SpotConfigStore.ts` owns the SPOT configuration file shape and exposes the backup folder to the framework backup location manager.
- `src/main/ipc/TaskStorageIpc.ts` names the SPOT storage IPC channels and hands the task operations to the framework storage command controller.
- `src/main/ipc/BackupLocationIpc.ts` names the SPOT backup folder channels and the wording of the native folder dialog.
- `src/main/ipc/AppInfoIpc.ts` answers the renderer's question of which build it is part of, with the version Electron reports for the running application.
- `src/main/storage/TaskStorage.ts` binds the framework storage core to SPOT: the SPOT database, the task command executor, the task loader, and the SPOT backup file naming. It also defines the SPOT storage contract used by IPC and the renderer.
- `src/main/storage/TaskCommandExecutor.ts` maps task storage commands to the task repository operations and keeps each command inside one transaction.
- `src/main/storage/SpotDatabase.ts` owns the SPOT schema: the migration list that currently creates schema version `1`, and the `openSpotDatabase()` helper that opens `spot.sqlite` through the framework database.
- `src/main/storage/TaskRowMapping.ts` maps between SQLite task rows and React `Task` objects and owns the shared task field to SQLite column mapping used by storage queries.
- `src/main/storage/TaskRepository.ts` owns SQLite task queries and task repository helpers that can run against an existing database wrapper or a short scoped repository session.
- `src/main/window/WindowLoadTarget.ts` resolves the built React `build/index.html` file from the Electron app root.
- `src/types` contains shared TypeScript types and constants split into semantic files for tasks, task storage, task-storage IPC channels, backup location, backup-location IPC channels, application info, application-info IPC channels, domains, and filters. The storage and backup types re-export the framework contracts and add only what is specific to SPOT. Types that have one clear owner stay in the owning `.ts` or `.tsx` file instead.
- `src/vite-env.d.ts` contains the Vite client TypeScript reference, which declares the CSS and asset imports, plus renderer-side declarations for `window.spotStorage`, `window.spotBackupLocation`, and `window.spotAppInfo`.
- `src/types/ElectronSquirrelStartup.d.ts` declares the one boolean `electron-squirrel-startup` exports, because the package ships no types of its own and a dependency for a single boolean would be more to keep up to date than it is worth.
- `src/components/common` contains layout and shared UI primitives, including `AppErrorBoundary.tsx`, which is what the user sees when a render error left nothing else to show.
- `src/components/inputs` contains reusable inputs.
- `src/components/tasks` contains the current task-management UI.
- `src/components/notes` and `src/components/tags` contain placeholder route pages.
- `src/components/settings` contains the Settings route page and the About section that names the running version.
- `src/components/storage` contains the Settings section that explains where the database lives and lets the user choose the backup folder.
- `src/contexts` contains app-level React contexts: the backup location and the task state.
- `src/logic` contains state and domain logic, including `PendingTaskChanges.ts`, which holds the task edits the user has not saved yet, `TaskStorageQueue.ts`, which creates the single renderer write queue from the framework and exposes it to the task components, `TaskComparison.ts`, which owns what a stored task is and how two of them are compared, `TaskStateAudit.ts`, which compares the tasks React holds against the tasks read back from the database, and `PaneLayout.ts`, which holds the width the user gave each resizable pane and the rules that width has to obey.
- `tests/framework` contains the tests for `src/framework`; `tests/main`, `tests/logic`, and `tests/components` contain the SPOT tests. `tests` also holds the test setup and test-only helpers.

## Source Imports

React source files use absolute imports rooted at `src/...`, including local CSS imports, instead of relative `./` or `../` paths. `tsconfig.json` sets `baseUrl` to the repository root so TypeScript and ESLint resolve those imports, and `vite.config.mts` declares the matching `src` alias so Vite and Vitest resolve them the same way at build and test time.

## Framework Layer

`src/framework` holds the reusable scaffolding an Electron + React + SQLite desktop application needs regardless of what it stores: logging, the database wrapper and its migrations, the storage core, rotated backups and their scheduling, the backup folder feature, the storage IPC chain and shutdown protocol, and the renderer write queue. It is kept here, inside SPOT, rather than as a package: the intent is to lift the folder into a second application as it is, and only turn it into a library once the same code has actually served two applications.

The rule that makes this possible is one-directional: **`src/framework` must never import SPOT code.** Everything it needs about SPOT arrives through its options. In particular:

- No `src/config/AppConfig` imports. Sizes, delays, retention counts, file names, and IPC channel names are parameters. SPOT passes them from `AppConfig` at the point where it composes the framework.
- No SPOT types. The framework is generic over the command type and the record type it stores; the storage envelope it does fix (status, failure reasons, results) lives in `src/framework/types`.
- No SPOT wording. Log messages the framework itself writes are generic; user-facing wording, dialog labels, and the messages the renderer shows are supplied by the application.

ESLint enforces the boundary: `src/framework/**` has a `no-restricted-imports` rule that rejects imports from `src/components`, `src/contexts`, `src/logic`, `src/main`, `src/types`, `src/utils`, and `src/config`.

The framework holds no module-level state. Everything is created by a factory, so a second application, or a test, can create its own instance. The one deliberate exception is `appLogger`, a process-wide handle the application initializes once at startup, which avoids threading a logger through every call.

SPOT binds to the framework in a thin layer of adapters, and those adapters are where SPOT's own names, channels, and wording live:

| Framework module | SPOT adapter |
| --- | --- |
| `main/logging/AppLogger.ts` | initialized in `src/main/Main.ts` from `LOGGING_CONFIG` |
| `main/config/RuntimePaths.ts` | `src/main/config/SpotRuntimePaths.ts` |
| `main/config/JsonConfigStore.ts` | `src/main/config/SpotConfigStore.ts` |
| `main/config/BackupLocationManager.ts` | composed in `src/main/Main.ts` with the SPOT directory store |
| `main/storage/AppDatabase.ts` | `src/main/storage/SpotDatabase.ts`, which owns the SPOT migration list |
| `main/storage/DatabaseStorage.ts` | `src/main/storage/TaskStorage.ts` |
| `main/storage/BackupScheduler.ts` | composed in `src/main/Main.ts` from `BACKUP_CONFIG` |
| `main/ipc/StorageCommandIpc.ts` | `src/main/ipc/TaskStorageIpc.ts` |
| `main/ipc/BackupLocationIpc.ts` | `src/main/ipc/BackupLocationIpc.ts` |
| `main/window/WindowLoadTarget.ts` | `src/main/window/WindowLoadTarget.ts` |
| `main/window/WindowNavigationGuard.ts` | installed on every window in `src/main/Main.ts` |
| `main/logging/ProcessCrashHandlers.ts` | installed in `src/main/Main.ts`, which reports what they catch |
| `renderer/StorageQueue.ts` | `src/logic/TaskStorageQueue.ts` |
| `i18n/Translator.ts`, `i18n/LanguageResolution.ts` | `src/i18n/Translations.ts` |
| `renderer/TranslationContext.tsx` | `src/i18n/TranslationContext.tsx` |
| `renderer/ErrorBoundary.tsx` | `src/components/common/AppErrorBoundary.tsx` |

Not everything reusable was moved. UI primitives under `src/components` stay in SPOT: they are worth copying into a second application, not sharing from one place.

The framework holds one exception to the no-module-level-state rule besides `appLogger`: `DateUtils` memoizes the start of the current day and the `Intl` formatters it builds, and `i18n/Translator.ts` memoizes the `Intl.PluralRules`, `Intl.NumberFormat` and `Intl.ListFormat` objects it builds, keyed by locale. Those caches are pure, so two applications sharing them could not observe each other through them, and the day cache invalidates itself when the day changes.

Tests for the framework live in `tests/framework` and use only framework modules, so they travel with the folder.

## Configuration

`src/config/AppConfig.ts` is the single place for app-wide configuration constants: sizes, delays, retry policies, and file or directory names that would otherwise be magic numbers spread across modules. Both the Electron main process and the React renderer import from it, so the file must stay free of Node and Electron imports.

The exported groups are:

- `WINDOW_CONFIG`: `BrowserWindow` initial (pre-maximize) size, the preload script file name, the built React index path segments, and the environment variable a development run names its renderer server in.
- `I18N_CONFIG`: the language used when the runtime asks for one SPOT does not ship a bundle for. It must be one of the languages listed in `src/i18n/Translations.ts`.
- `STORAGE_CONFIG`: the database directory name, the SQLite database file name, the current schema version, the SQLite connection timeout, the delay before a failed task write is retried, and how many consecutive database errors on one write are retried before that change is given up on.
- `BACKUP_CONFIG`: the default backup directory name, the backup file prefix and extension, the partial and temporary file names used while a backup is being written, the delay after the last task change before a backup runs, the number of retained backups, and the bounded time the shutdown backup is given.
- `APP_CONFIG_FILE`: the development root directory name and the application configuration file name.
- `LOGGING_CONFIG`: the log directory name, the operational log file name, the maximum file size, and how many rolled archives are kept. The last two bound the log directory together: it holds at most `retainedArchiveCount + 1` files of `maximumFileSizeBytes` each.
- `TASKS_CONFIG`: the task flush delay, the task state change delay, the manual sort position step, and how many days after tomorrow a due date is shown as a weekday name instead of a full date.
- `PANE_LAYOUT_CONFIG`: where the divider of a resizable split page starts, how much one arrow key press moves it, and the floor width for a pane that holds no header. How narrow a pane may get is measured from the headers it holds, so that floor only applies to a pane with none.
- `AUDIT_CONFIG`: whether the task state audit runs at all, the delay before its first run, the delay between runs, and how many differing tasks one report lists.
- `SHUTDOWN_CONFIG`: the bounded time the main process waits for the renderer to flush its buffered task changes before quitting, plus how many times the renderer flushes its buffer within that wait. The timeout is derived from the whole retry budget of one command, `STORAGE_CONFIG.writeRetryDelayMs` multiplied by `STORAGE_CONFIG.maximumWriteAttempts`, and not from a single retry delay: a retry that fails again schedules the next one, and the renderer cannot ask for that retry sooner while it is already waiting for the queue, so a wait covering only one delay would expire while the retry that saves the change has not run yet. The queue gives a change up after that many attempts, so the timeout is also the longest a quit can be held, and only while writes keep failing.

Each group is declared `as const`, so consumers that pass a value to a widened parameter may need an explicit type annotation. User-facing text is not configuration: it lives in the translation bundles described in the Text And Languages section. Developer-facing strings, meaning log messages, `console` output and the messages of errors only a bug can raise, stay in the module that owns them.

## Application Shell

`src/index.tsx` renders:

- `TranslationProvider`
- `AppErrorBoundary`
- `BackupLocationContextProvider`
- `TasksContextProvider`
- `HashRouter`
- `Sidebar`
- `MainContent`
- routes for Tasks, Notes, Tags, and Settings

Routes:

- `/` renders `TasksPage`
- `/notes` renders `NotesPage`
- `/tags` renders `TagsPage`
- `/settings` renders `SettingsPage`

`Sidebar` links only Tasks and Settings. Notes and Tags keep their routes and their placeholder pages, but nothing navigates to them: a released SPOT should not offer a page that does nothing. Restoring them is putting their `SidebarElement` back.

Every context provider is mounted above `HashRouter`, so route state is the only thing navigation changes. Page components hold what only they need: anything that must survive navigation belongs to a provider. There is no single application-wide store, because a shared one would re-render every page on any change; each provider owns one area.

Nothing gates the app at startup: the database is always in the user-data folder, so the task page renders right away and the backup folder is only a Settings concern.

`AppErrorBoundary` sits directly under `TranslationProvider` and above everything else, so a render error anywhere below it, including in a context provider above the router, shows a message and a reload button instead of the blank window React leaves behind when nothing catches a throw. It wraps the whole application rather than one page because the providers above the router are exactly where a failure would otherwise be unrecoverable. Reloading is the only recovery it offers: rendering the same tree again would usually throw the same error a second time, while a reload starts over from the tasks the database holds. It says so too, and promises nothing about what was being typed at that moment. The failure itself goes to the renderer console, which is developer-facing: the renderer has no route into the operational log.

The page layout is a fixed-height flex app:

- `#root` is a horizontal flex container.
- `Sidebar` stays on the side.
- `MainContent` renders the selected route.
- `Page` and `Pane` build the page-level split layout.
- `ResizablePanes` and `PaneDivider` make a two-pane page resizable, as described in the Resizable Panes section.

## Electron Layer

`package.json` points Electron at `dist/electron/main.js`, which is generated from `src/main/Main.ts` by `npm run build-electron`. The build script bundles `src/main/Main.ts` and `src/main/preload/Preload.ts` with `esbuild`, preserving external Electron and `electron-log` imports while resolving in-repository `src/...` imports at build time.

Electron Forge copies the `dependencies` of `package.json` into the packaged application, and nothing else, so which section a package sits in decides whether it ships. Anything only the build or the tests need therefore belongs in `devDependencies`, including the Testing Library packages: they are imported by `tests` alone, and leaving them in `dependencies` puts a test framework inside every build that never runs it.

One kind of launch is not the user's at all and is turned away before the lock is even considered. The Windows Squirrel installer runs SPOT itself to create and remove its shortcuts, naming the step on the command line. `electron-squirrel-startup` does that step at import time and reports that it did, and `Main.ts` then quits instead of opening a window in the middle of an install, an update or an uninstall. It comes before the lock because the installer can run those steps while SPOT is already open, and a launch that took the lock would have to be a second instance to do anything at all. The value is false on every other platform and on every ordinary launch, so nothing else changes.

Only one SPOT process runs at a time. `Main.ts` takes Electron's single instance lock before anything else, and a launch that does not get it quits immediately, before `ready`, so it opens no database, writes no log file and schedules no backup. The instance holding the lock receives `second-instance` instead and reveals its own window: restored if minimized, shown and focused otherwise, unless it is already shutting down and has hidden that window on purpose.

A second instance is prevented rather than supported because nothing in the persistence design accounts for one. Two processes would hold the same `spot.sqlite` open, and SQLite would keep the file consistent between them, but the two task states would not: each renderer reads the tasks once at startup and writes optimistically afterwards, so every change one process saves is invisible to the other, whose own writes then go on top of it. A task deleted in one instance makes the other's next write of it fail, because the repository requires each command to change exactly one row. The audit would report all of this as a drift for the rest of the session, which is exactly what it cannot tell apart from a real one. The two backup schedulers would also prune each other's backups and clear each other's `.part` files mid-copy, and the two loggers would rotate the same log file underneath each other.

Operating systems disagree on how easily a second launch happens, which is why the lock is taken rather than left to them: macOS refuses a second launch of the same bundle from Finder or the Dock but not `open -n`, while Windows and Linux start as many processes as the user asks for. The lock is keyed on the Electron user-data folder, so a development run and an installed SPOT exclude each other even though they keep their files in separate roots.

`src/main/Main.ts` is the composition root. It installs the process crash handlers first, before anything can fail, then resolves the language, resolves the runtime paths with `resolveSpotRuntimePaths()`, and initializes `appLogger` with the `LOGGING_CONFIG` settings as soon as Electron is ready. It then creates the task storage on the runtime database folder and registers the storage IPC handlers from `src/main/ipc/TaskStorageIpc.ts`, which also attach the storage shutdown drain to Electron's `before-quit` event, the backup scheduler, and the backup location handlers from `src/main/ipc/BackupLocationIpc.ts`. It resolves the backup folder through `BackupLocationManager.initialize()` before creating the `BrowserWindow`. The window is created hidden and maximized to the screen work area on its `ready-to-show` event before being shown, so it starts at full screen size without engaging macOS's separate native fullscreen window state. It uses `resolveWindowLoadTarget()` from `src/main/window/WindowLoadTarget.ts` to decide what the window loads: the built React `build/index.html` file through `loadFile()`, or the development server through `loadURL()` when an unpackaged run was started with one, as the Development Loop section describes.

Every window `Main.ts` creates gets the navigation guard from `src/framework/main/window/WindowNavigationGuard.ts` installed on its `webContents`, which keeps it on the page the main process loaded into it. The renderer's Content-Security-Policy says what the page may load, not where the page may go: a link, a script or an embedded editor could otherwise navigate the whole window somewhere else, and that page would sit behind the same preload bridge. The guard denies every window the page tries to open, since nothing in SPOT opens a second one, and prevents every whole-page navigation to anything but the page the window was loaded with. `HashRouter` is unaffected, because a route change moves through the fragment and stays on the same document, which never raises `will-navigate`. A development run is allowed anywhere on its server's origin, since the server reloads the renderer at paths of its own, while a built run is matched on the `file://` path of `build/index.html` alone. Everything refused is logged as `blocked-navigation`.

Every window `Main.ts` creates also intercepts its own `close` event with `requestRendererFlushBeforeWindowClose()` from the storage IPC handlers: the close is prevented, the renderer flush handshake runs, and the window is destroyed only once the renderer reported or the handshake timed out. Without it the buffered task edits would be lost on the usual way of closing the application, because closing the window destroys the renderer before `before-quit` runs on Windows and Linux and without quitting at all on macOS.

`Main.ts` also passes `onRendererFlushCompleted` to the storage IPC handlers and hides the window from it, so a quit stops collecting task changes at the moment it stops storing them. The Failure And Shutdown section explains why.

The scheduler and the storage IPC handlers need each other: the handlers return the serial storage chain the scheduler runs backups on, and the scheduler provides the callbacks the handlers use to restart the backup delay after an applied command and to run the shutdown backup. `Main.ts` resolves that by registering the handlers first with callbacks that read a scheduler variable assigned right afterwards.

`src/main/preload/Preload.ts` exposes three narrow APIs and nothing else: `window.spotStorage` and `window.spotBackupLocation`, both documented in the Persistence section, and `window.spotAppInfo`, which answers with the version Electron reports for the running application. It does not expose raw `ipcRenderer`, filesystem, SQLite, or dialog objects. Shared IPC channel names live in `src/types/TaskStorageIpcChannels.ts`, `src/types/BackupLocationIpcChannels.ts` and `src/types/AppInfoIpcChannels.ts` so preload and main-process handlers cannot drift.

The version is asked of the main process rather than read from `package.json` at build time, because `app.getVersion()` is what the running application actually reports: a renderer bundle built separately could otherwise name a version the installed copy does not have. `src/main/ipc/AppInfoIpc.ts` registers the one handler, and it reads the version on every request instead of capturing it once.

## Application Icon

`assets/icon.svg` is the only hand-edited icon file: a dark rounded tile carrying concentric accent rings, a solid centre dot, and a white checkmark inside that dot. It uses the same `#0099FF` accent and dark background as the renderer theme. Everything else is generated from it by `npm run build-icons`, which runs `scripts/build-icons.js` under Electron and rasterizes the master with Electron's own Chromium, so no image library or external converter is a dependency.

The script produces two tiles from the same master, because the platforms disagree on framing:

- The macOS tile follows Apple's icon grid, an 824x824 body centered on a 1024x1024 transparent canvas. macOS draws `.icns` artwork exactly as given and masks nothing, so a full-bleed tile would sit noticeably larger than every neighbouring dock icon.
- The full-bleed tile fills its canvas, which is what Windows and Linux expect since they scale and mask the artwork themselves.

From those it writes three committed files: `assets/icon.icns` for macOS, built by piping a full `.iconset` through the macOS `iconutil` command, `assets/icon.ico` for Windows, packed directly as an ICO container of PNG entries from 16 to 256 pixels, and `assets/icon.png` at 512 pixels for Linux. Because `iconutil` only exists on macOS, a run on another platform skips the `.icns` file and keeps the other two.

Two details of the render are deliberate and easy to break. The window uses a fully transparent `backgroundColor` rather than a `transparent` window, because a transparent window needs a real display and fails when the build runs headless. Both tiles are laid out side by side in one page and taken in a single capture, then cropped apart, because a window reliably serves only one load and one capture: a second load, or a second window, fails once the first capture is done. The capture comes back at the display's device scale factor, so the script accepts anything at or above the canvas size and derives every icon size from it by resizing down.

`forge.config.js` points `packagerConfig.icon` at the extension-less `assets/icon` path and lets the packager choose `.icns` or `.ico` per platform, while `maker-squirrel` takes `icon.ico` as its `setupIcon` and `maker-deb` and `maker-rpm` take `icon.png`. The packager reads those files straight from the repository at package time, so `assets` is in the `packagerConfig.ignore` list and never ends up inside the application bundle. That ignore pattern is anchored to the repository root and so does not touch the `build/assets` renderer output, which must stay in the bundle.

## Persistence

SPOT persists tasks only in Electron runtime. The Electron main process owns durable storage, operational logging, database health, and backups, while React owns the responsive in-memory task state used by the UI. The renderer requires `window.spotStorage` and `window.spotBackupLocation` on startup; opening the React build outside Electron reports storage as unavailable.

SQLite is the source of truth for task reads and writes. The append-only operational log is a diagnostic trace of storage commands and SQL activity; startup never rebuilds task state from the log.

### Local Database And Backup Folder

The live database always lives on the local user-data disk and is never placed in a folder that a synchronization client controls. This is the design decision the rest of the persistence layer depends on:

- A synchronization client replaces files behind the process holding them open. When it does so through the usual unlink-and-rename, the SQLite connection keeps reading and writing an unlinked inode: every write reports success and the whole session is lost on quit. Keeping the database local removes that failure entirely.
- Because the database is local, write-ahead logging is safe to use, and its `-wal` and `-shm` companion files never have to be understood by a synchronization client.
- The backup folder only ever receives finished files. Each backup is built locally and published with an atomic rename, so a synchronization client watching that folder cannot observe a database that is still being written.

The backup folder is therefore a write-only destination. SPOT never reads a backup back, never compares one against the live database, and does not keep two computers in sync. Restoring a backup is a manual step: with SPOT closed, copy the chosen file over `spot.sqlite` in the database folder. The Settings notice about the backup folder says this too, because a backup nobody knows how to use is not a backup, and it says what the copy costs: every change made after that copy was written is replaced.

### Storage Files

`src/main/config/SpotRuntimePaths.ts` resolves the fixed paths inside the Electron user-data folder, giving development runs their own root:

| Path | Packaged run | Development run |
| --- | --- | --- |
| Configuration file | `<userData>/spot-config.json` | `<userData>/dev/spot-config.json` |
| Log directory | `<userData>/logs` | `<userData>/dev/logs` |
| Database folder | `<userData>/storage` | `<userData>/dev/storage` |
| Default backup folder | `<userData>/backups` | `<userData>/dev/backups` |

The database folder contains:

- `spot.sqlite`: the canonical task database, plus its `-wal` and `-shm` companion files while the app runs.
- the temporary backup snapshot, which exists only while a backup is being written.

The log directory contains:

- `spot-logs.ndjson`: newline-delimited operational log entries.
- `spot-logs.old.1.ndjson` up to `spot-logs.old.<LOGGING_CONFIG.retainedArchiveCount>.ndjson`: the rolled log archives, numbered from the newest.

The backup folder contains up to `BACKUP_CONFIG.retainedBackupCount` files named `spot-backup-<timestamp>.sqlite`. The timestamp is the ISO instant with colons and dots replaced, so the files sort chronologically by name. Anything else the user keeps in that folder is left alone.

### Backups

`src/framework/main/storage/DatabaseBackup.ts` writes one backup, using the file naming and retention count SPOT passes from `BACKUP_CONFIG`:

1. `VACUUM INTO` a temporary file in the local database folder. This is the only step that touches the database, it runs in its own read transaction, and it produces a complete self-contained database with no journal and no write-ahead log. A plain file copy is not used: it would capture a database mid-transaction, and under write-ahead logging it would silently miss everything still in `spot.sqlite-wal`.
2. Copy that inert file into the backup folder under a `.part` name. Nothing is writing to the source, so this copy is safe however slow the destination is.
3. Rename the `.part` file to its final name. The rename is atomic within the folder.
4. Prune the folder down to the retained backup count, oldest first.

A `.part` file left behind by an interrupted backup is cleared at the start of the next run. Steps 2 to 4 are asynchronous on purpose, so the shutdown timeout can actually abandon a backup whose destination has become slow or unreachable.

`src/framework/main/storage/BackupScheduler.ts` decides when that runs, using the delays SPOT passes from `BACKUP_CONFIG`:

- Every applied task command restarts a `BACKUP_CONFIG.delayAfterChangeMs` timer, so a burst of edits produces one backup once the user has stopped, not one per edit.
- Backups run through `runExclusively()` on the serial storage chain, so a snapshot is never taken while a write transaction is open, and two backups never overlap.
- A backup only runs when something changed since the last one. A failed backup leaves the changes marked as pending so the next run retries them, and a change made while a backup runs schedules the next one instead.
- Shutdown runs one last backup after the in-flight commands are drained and before the database is closed, bounded by `BACKUP_CONFIG.shutdownTimeoutMs`. A backup folder that stopped answering delays the quit by at most that timeout and then loses only that backup: the database is the source of truth and is already saved.

### Backup Folder Selection

`src/framework/main/config/BackupLocationManager.ts` owns the backup folder and reports it as a `BackupLocation` with `directory`, `defaultDirectory`, `databaseDirectory`, `databasePath`, `isDevelopment`, and an optional `message`.

Startup resolution:

- A packaged run reads `backupDirectory` from the configuration file, creates it when missing, and validates it.
- A packaged run with no saved folder uses the default `<userData>/backups`.
- A saved folder that cannot be used does not stop anything: SPOT falls back to the default folder and explains the failure in `message`. Backups are not the source of truth, so an unreachable folder is a notice, not a blocker.
- A development run always restarts on `<userData>/dev/backups`, ignoring the folder saved during a previous development session. Changing the folder from Settings still works for testing, and it is written to the development configuration file only.

Changing the folder from Settings validates and creates it, puts the change on the serial storage chain through `runExclusively()` so a backup already being written to the old folder finishes first, saves it in the configuration file, and asks the scheduler for a backup covering the change. Copies already written to the previous folder are left where they are. Nothing about the database moves, so React neither flushes nor reloads anything.

The renderer uses the narrow `window.spotBackupLocation` API:

- `getBackupLocation()` returns the current `BackupLocation`.
- `chooseBackupDirectory()` opens the native folder dialog and returns the chosen folder, or a cancelled or invalid result.
- `setBackupDirectory(directory)` applies and saves a folder.
- `setDefaultBackupDirectory()` creates the default folder if needed, then applies and saves it.

### SQLite Schema

`src/framework/main/storage/AppDatabase.ts` opens or creates the database file using Electron's bundled Node `node:sqlite` support. No external SQLite dependency is used. The connection is switched to `journal_mode = WAL` right after it is opened, which is safe because the database file never leaves the local user-data disk. The raw SQLite connection stays private to `AppDatabase.ts`; storage uses wrapper methods for SQL execution, row reads, transactions, and the backup `VACUUM INTO`. `src/main/storage/SpotDatabase.ts` supplies the SPOT part: the `spot.sqlite` file name and the migration list. `createTaskStorage({ databaseDirectory, backupDirectory })` owns one lazy database wrapper, opens it on the first status, load, write, or backup operation, reuses it across storage calls, and closes it from `prepareForShutdown()`. That close is final: storage never opens the database again, and a status query, a load, or a command arriving after it fails with `STORAGE_CLOSED_MESSAGE` instead. Reopening would leave behind a connection nobody closes a second time, and a write-ahead log that is never checkpointed, which is reachable in practice because a command refused as `shutdown` reads the storage status to answer, and because the renderer can still retry a write between the quit drain and the process actually going away.

Schema version `1` creates `schema_migrations` and `tasks`:

- `tasks.id TEXT PRIMARY KEY`
- `tasks.text TEXT NOT NULL`
- `tasks.state TEXT NOT NULL`
- `tasks.priority TEXT NOT NULL`
- `tasks.owner TEXT`
- `tasks.due_date TEXT`
- `tasks.tags_json TEXT NOT NULL`
- `tasks.sort_position INTEGER NOT NULL`
- `tasks.completion_date TEXT`
- `tasks.created_at TEXT NOT NULL`
- `tasks.updated_at TEXT NOT NULL`
- `schema_migrations.version INTEGER PRIMARY KEY`
- `schema_migrations.applied_at TEXT NOT NULL`

`src/main/storage/TaskRowMapping.ts` maps SQLite rows to React `Task` objects. `tags` are stored as `tags_json`, `completionDate` is stored as an ISO string in `completion_date`, optional string fields are stored as `NULL`, and the runtime-only `visible` flag is not stored. `TASK_FIELD_COLUMN_MAPPINGS` is the shared source for task field names, SQLite column names, mutability, and serialization/parsing behavior.

### Persistence Contract

`src/main/storage/TaskStorage.ts` defines the storage boundary. It exports `createTaskStorage()`, `TaskStorage`, `TaskStorageCommand`, `OperationalLogEntry`, and the storage status/result types. `src/types/TaskStorageTypes.ts` owns the shared command, result, status, and `SpotStorageApi` types used across main-process storage, IPC, and renderer declarations.

The preload API is deliberately narrow and does not expose raw `ipcRenderer`, filesystem, or SQLite objects:

- `window.spotStorage.loadTasks()` invokes `spot-storage:load-tasks` and returns `{ ok: true, tasks, status }` or a storage failure.
- `window.spotStorage.executeTaskCommand(command)` invokes `spot-storage:execute-task-command` and returns `{ ok: true, status }` or a storage failure.
- `window.spotStorage.getStorageStatus()` invokes `spot-storage:get-storage-status` and returns the latest database status.
- `window.spotStorage.onFlushPendingTaskChanges(listener)` subscribes to the main-process shutdown flush request on `spot-storage:flush-pending-task-changes` and returns the unsubscribe callback.
- `window.spotStorage.onBackupStatusChanged(listener)` subscribes to `spot-storage:backup-status-changed` and returns the unsubscribe callback. Backups run on a timer, long after the command that triggered them was answered, so their outcome is pushed instead of riding on a command result.
- `window.spotStorage.notifyPendingTaskChangesFlushed()` invokes `spot-storage:pending-task-changes-flushed` to report that the buffered task changes reached storage.

Supported write commands are:

- `task.create`
- `task.update`
- `task.delete`
- `tasks.updateMany`

Completing and restoring tasks are represented as `task.update` commands because they update `state` and `completionDate`. Manual reorder and sort by importance use `tasks.updateMany` with a `reason`, such as `manual-reorder` or `importance-sort`.

Each task write command runs in exactly one SQLite transaction on the storage-owned connection. Bulk changes must not be split into per-task transactions. Transactions are opened with `BEGIN IMMEDIATE`, never a plain deferred `BEGIN`: the write lock is taken upfront so a concurrent writer on the same database file cannot make the transaction fail with an unrecoverable `SQLITE_BUSY` while it upgrades from a read to a write. The busy handler installed through `STORAGE_CONFIG.databaseTimeoutMs` can then retry the initial lock acquisition normally. Fields marked immutable in `TASK_FIELD_COLUMN_MAPPINGS`, currently `id`, cannot be included in update changes, and a change that sets a field marked required there to `undefined` is refused the same way. If an update or delete references a missing task row, the command fails and the transaction rolls back. Every one of those failures is reported as `invalid-command`, not as `database-error`: none of them would go any differently later, so retrying such a command would never succeed and would keep every task change made afterwards from ever being written, because the write queue never lets a later command overtake a failed one. Task durability is immediate and does not rely on delayed batching.

`readTasksFromDatabase()` in `src/main/storage/TaskRepository.ts` maps each row independently: a row that fails mapping (unrecognized `state`/`priority`, or malformed `tags_json`) is skipped and logged with `appLogger.warn()` rather than failing the whole load, so one corrupt row cannot hide every other task behind a storage-unavailable state.

### Renderer Behavior

React calls `loadTasks()` through `window.spotStorage` once on startup and calls `executeTaskCommand()` for task mutations. The database never moves, so there is nothing that makes React reload it. It updates optimistically for normal task changes, keeps the latest renderer-facing `StorageStatus`, stays quiet while the database is healthy, shows startup storage failures before rendering task lists, shows a prominent save warning when writes fail, and shows a quieter notice when backups fail. It calls `loadTasks()` again only for the periodic audit described below, which reads without ever writing what it read into the task state.

### Writing Task Changes

`src/logic/TaskStorageQueue.ts` owns every task write. It creates the single renderer queue from `src/framework/renderer/StorageQueue.ts`, supplying the bridge to `window.spotStorage`, the `STORAGE_CONFIG` retry policy, and the warning wording. Commands are queued and written one at a time and in order, so a write that fails cannot be overtaken by later ones.

What a command carries is decided by `src/logic/TaskComparison.ts`, which owns the persisted shape of a task and the comparison of two of them: `taskToPersistedTask()` reduces a task to what the database holds, normalized the way the database holds it, and `createPersistedTaskChange()` keeps only the fields whose stored value differs. A field the user cleared is present in the change and `undefined`, which is what stores it as NULL. The audit compares by exactly the same rules.

- A write that fails with `database-error`, or whose call throws, stays at the front of the queue and is retried every `STORAGE_CONFIG.writeRetryDelayMs`. A database that failed once can work again, and the change is not lost in the meantime.
- Those retries are bounded by `STORAGE_CONFIG.maximumWriteAttempts` consecutive database errors on the same command. Not every database error clears: a constraint violation or a full disk fails the same way every time, and an unbounded retry would keep that command at the front of the queue and leave every change made afterwards unwritten for the rest of the session. After the last attempt the command is given up on and reported with its own warning, which says the change is not stored, so the queue can move on.
- A write refused as `shutdown` was never attempted, so it stays queued and retried too, is never counted against the retry limit, and is never counted as a change storage will not accept.
- A write refused as `invalid-command` would be refused again in exactly the same way, so it is dropped instead of retried.
- `retryTaskStorageQueueNow()` writes the queue again immediately instead of waiting out the retry delay. The renderer flush handshake calls it, because the main process waits for a bounded time and a pending retry could use all of it up.
- A failed write does not touch the task state. The state holds what the user wanted, and reading the database back over it would throw that away, so React keeps it and only warns. There is no reconciliation and no reload after a write failure.
- The warning lives as long as the change is unwritten: it is cleared when the queue drains, never by an unrelated command that happened to succeed. A dropped command warns for the rest of the session, because that change will never be written and tasks are only loaded at startup. `clearTaskStorageFailures()` forgets those warnings and is meant for a reload that has succeeded; nothing calls it today.
- Successful writes are silent. There is no saving or saved indicator.

### Buffered Task Changes

Task edits are not sent to the task state on every keystroke. `src/logic/PendingTaskChanges.ts` holds them in a buffer keyed by task ID, outside the component tree, so that they cannot be lost when a task component re-renders, is filtered out, or unmounts.

- Task components read the buffer through `useSyncExternalStore` and render the task state merged with it. The rendered value is derived from both on every render, so the inputs and the task state can never drift apart.
- Only the components of the edited task re-render while the user types, because subscribers are registered per task ID.
- Every buffered value carries a flush mode. A `delayed` change is saved after `TASKS_CONFIG.flushDelayMs`, or after the shorter `TASKS_CONFIG.stateChangeDelayMs` when it is a pending state change, and restarts that delay on every new change. An `immediate` change is saved right away. A `buffered` change only waits in the buffer: it neither starts nor postpones a save, and it is saved by the next save of the same task, by leaving the input, or by the final flush. A value brought back to the one already in the task state is dropped from the buffer.
- Tags use the `buffered` mode while the user types, so a half-typed tag never reaches the database on its own, and the `immediate` mode when the user leaves the tag input.
- `TasksContextProvider` registers the single applier that saves buffered changes. It looks the task up by ID in the current task state, so changes are always applied to the task as it is at save time, and a task that no longer exists is skipped.
- `TasksContextProvider` clears the buffer of a deleted task. It lives as long as the renderer, so leaving the task page no longer unregisters the applier and no longer has to flush anything first: buffered changes keep saving normally while the user is on another page.
- A save takes out of the buffer only what it is actually saving. Anything the user typed in the meantime and that is not part of that save stays buffered.
- Buffered changes are never dropped when no applier is registered: they stay buffered until one is.
- An applier that throws saved nothing, so what the save took out of the buffer goes back into it. The buffer is the only place those values still exist at that point, and values buffered while the applier ran are newer and win field by field.
- The flush of the whole buffer saves each task on its own: one task that cannot be saved is reported to the console and leaves its values buffered, while the other tasks are still saved. It never throws, because its callers are the renderer going away, the page hide, and the provider teardown, none of which can do anything about a failure. A single-task save still reports it to its caller.

`StorageStatus` reports the database state as `healthy` or `unavailable`, plus `storageDirectory`, `databasePath`, and a `backup` status. Database health is hard: `unavailable` means the tasks may not be saved and React says so prominently. Backup health is soft and separate: `idle`, `ok`, or `failed`, with the backup `directory`, the `lastBackupAt` and `lastBackupPath` of the last successful one, and a failure `message`. A failed backup never makes the database unhealthy, because the tasks are already saved in the local database either way.

`StorageStatus` also keeps the `not-configured` database state and the `not-implemented` failure reason, which the main process never produces. They are used only by the renderer, to describe a React build opened without the Electron preload API. The remaining storage failures are `database-error`, `invalid-command`, and `shutdown`.

### Auditing The Task State

Task updates are optimistic and tasks are only read at startup, so nothing in a running session would notice a change that never reached the database: the task state keeps showing it, and the next launch is the first thing that does not. The audit closes that window. It is a first-period safety net, switched on through `AUDIT_CONFIG.enabled` and meant to be switched off once the write path has been trusted for a while, not a part of that write path.

`TasksContextProvider` schedules it. `AUDIT_CONFIG.initialDelayMs` after the startup load, and every `AUDIT_CONFIG.intervalMs` after that, it reads the database back through the existing `loadTasks()` and hands both sides to `auditTaskState()` in `src/logic/TaskStateAudit.ts`. There is no separate audit IPC channel and nothing new in the main process: `loadTasks()` already runs on the serial storage chain, so the audit read is ordered behind the commands and backups already running and can never observe a half-applied transaction.

- The audit reschedules itself when it finishes instead of running on an interval, so a read waiting behind a write or a backup can never have another one queued up behind it.
- It only runs when the task state has nothing left to write: the pending-changes buffer is empty, the storage queue is idle, and no change is reported as unsaved. Until then the task state is ahead of the database because that is how the write path works, and an audit would report the design as a defect. `isTaskStorageQueueIdle()` answers the queue part of that question without waiting for it, because an audit that has to wait has nothing to do in the meantime and is better skipped.
- It also skips a hidden window, so it never starts a read while the application is quitting.
- The user can change anything while the database is being read, so the task state carries a generation counter that `commitTaskState()` bumps. An audit whose generation moved, or whose quiescence no longer holds when the read returns, is dropped rather than reported: it would be reporting the change it raced.
- A read that fails is not a drift. The storage status already reports a database that cannot be read, so the audit stays quiet about it.

`auditTaskState()` compares only what the database holds, through the same `taskToPersistedTask()` in `src/logic/TaskComparison.ts` that decides what a write sends. That shared definition is the point: an audit with its own idea of equality would find differences the write path never had any reason to store. It reports three kinds of difference, `missing-in-database`, `missing-in-state`, and `different-values` with the differing field names, capped at `AUDIT_CONFIG.maximumReportedTasks` while the reported count stays the real total.

What it finds is reported and never reconciled. The task state holds what the user wanted, and the audit has no way of knowing which of the two sides is the mistaken one, so overwriting either would be guessing. A drift is written to the developer console with the tasks and fields it found, and shown in the task page as a notice, below every failure that means something is not being saved right now. The notice stays for the rest of the session: the audit is there to make sure a drift is not discovered by the next launch, and a later write that happens to paper over it does not make it not have happened.

`src/logic/TaskComparison.ts` also normalizes an optional field the user emptied to `undefined`, because that is what the database stores it as and reads it back as. Without it, clearing an owner or a due date would send a change the database is already holding, and would then look like a drift on every audit for the rest of the session.

### Operational Logging

`src/framework/main/logging/AppLogger.ts` uses `electron-log` version `5.4.4` to write newline-delimited JSON entries to the log file of the current run, which for SPOT is `spot-logs.ndjson`. The dependency is wrapped by `createAppLogger()`, while `initializeAppLogger()` installs the concrete logger behind the process-wide `appLogger` utility. Main-process code can call `appLogger.info`, `appLogger.warn`, `appLogger.error`, `appLogger.debug`, and `appLogger.flush` without depending on `electron-log` directly or constructing a logger itself. The file name, size limit, and retained archive count are passed in by the application: SPOT supplies them from `LOGGING_CONFIG`.

The main process logs every incoming React storage command and every SQL query run by the storage layer, including `SELECT` queries. SQL log entries include the query text, `elapsedMillis`, and success or failure. Query parameters should be logged only when they are useful for debugging and safe to write to disk.

Example entries:

```json
{"createdAt":"2026-06-02T12:00:00.000Z","level":"info","message":"React storage command received","type":"react.command","command":"task.update","payload":{"taskId":"...","change":{"text":"New"}}}
{"createdAt":"2026-06-02T12:00:00.001Z","level":"info","message":"React storage command received","type":"react.command","command":"tasks.updateMany","payload":{"reason":"manual-reorder","updates":[{"taskId":"...","change":{"sortPosition":1000}},{"taskId":"...","change":{"sortPosition":2000}}]}}
{"createdAt":"2026-06-02T12:00:00.003Z","level":"info","message":"Storage SQL query completed","type":"sql.query","query":"UPDATE tasks SET text = ? WHERE id = ?","elapsedMillis":2.4,"result":"success"}
```

Logger write methods return `void`; normal callers do not await operational logging or inspect write outcomes. The file transport writes only JSON lines and rolls the file once it passes `LOGGING_CONFIG.maximumFileSizeBytes`, currently 100 MiB.

`AppLogger` owns the rolling itself, through the archiver it installs on the file transport. `electron-log` only ever keeps one archive of its own, so keeping `LOGGING_CONFIG.retainedArchiveCount` of them is done in `createArchiveLogFn()`: each archive moves one place down, the oldest falls off the end, and the file that just filled up becomes `spot-logs.old.1.ndjson`. The log directory therefore holds the current file plus at most that many archives, which bounds the whole directory at `retainedArchiveCount + 1` times the size limit. A count of `0` keeps no archive and simply discards the filled-up file, which still has to happen for the transport to reopen an empty one.

A rotation that fails is ignored exactly like a write that fails: the log is a diagnostic trace and never a source of truth, and there is nobody to report the failure to who could act on it.

It writes synchronously, so an entry is on disk before the call that logged it returns and the entries describing a crash survive it. The outcome of a write is deliberately not checked, and a failed write is simply lost: the log is a diagnostic trace and never a source of truth, so reading the file back to confirm every line would cost far more than writing it, on every statement of every transaction, to protect something the persistence contract already allows to fail. There is no retry either, because nothing reports a failure to retry. The one failure the logger does handle is an entry holding a value JSON cannot represent, which is swallowed rather than raised at the caller.

`flush()` is reserved for shutdown preparation. Nothing is ever pending, so it resolves immediately; it stays part of the logger so shutdown keeps one place to wait on, and so a buffering transport could be introduced later without changing its callers.

### Failure And Shutdown

Database write failures are user-facing. The SQLite transaction must not partially commit and the main process reports the failure to React, which keeps the task state, retries the write, and warns the user. Database read or startup failures are also user-facing; React receives a storage error state instead of silently falling back to stale persisted data.

Operational-log failures are not renderer-facing. Startup log file open failures are tracked internally by `AppLogger`, and runtime log write failures are neither detected nor retried: the entry is lost while SQLite keeps succeeding. Database folder failures must leave persistence visibly non-healthy rather than pretending data is saved.

Backup failures are renderer-facing but never alarming. They are logged, reported through the pushed backup status, and shown as a notice in the task page and in Settings, always stating that the tasks themselves are saved. A backup failure must never be routed through the database error path.

The failures none of those paths know about are caught by the process crash handlers `Main.ts` installs from `src/framework/main/logging/ProcessCrashHandlers.ts`, before anything can fail. An exception reaching the top of the main process, or a promise nobody handled, would otherwise take the window down or vanish without a word, and there would be nothing afterwards to tell those two apart. Both are logged as `uncaught-exception` or `unhandled-rejection` with their stack, and reported to the user in a native error box, because a main-process failure may leave no window to show anything in. Only the first one opens a box: a process that started failing usually keeps failing, and a stack of error boxes would bury the window instead of saying anything the first one did not.

Startup is the case that needs this most, because it runs inside a promise: anything that throws while resolving the runtime paths, opening the database or resolving the backup folder happens before the window exists, so without this SPOT would simply never appear and leave nothing behind to explain it. That promise therefore has a `catch` of its own that logs the failure as `startup-failed`, reports it, and quits, rather than leaving a process running with nothing on screen. The language is resolved as the very first thing after Electron is ready, before any of that, so that every failure from there on has wording to report itself with. A failure earlier than that is a failure to start at all, with no logger and no translator yet, and can only be left to the platform.

Installing an `uncaughtException` handler stops Node from exiting on one, and SPOT keeps it that way on purpose for failures after startup: the window is still up, its close handshake still saves the buffered edits, and killing the process would lose them. The framework only logs and reports; whether to quit is the application's decision at each site.

`src/main/ipc/TaskStorageIpc.ts` registers a `before-quit` drain. The first quit request waits for in-flight task write commands, runs the last backup under its bounded timeout, calls `prepareForShutdown()` so the SQLite connection closes, flushes the process-wide logger, and then resumes quitting. New write commands after shutdown begins return a `shutdown` failure instead of being enqueued behind the quit drain.

React buffers task edits for a few seconds, so the quit drain would close the database while the user's last keystrokes are still in the renderer. The first quit request therefore starts with a renderer flush handshake:

1. The main process sends `spot-storage:flush-pending-task-changes` to the window and waits.
2. Task write commands keep being accepted during that wait, because refusing them is exactly what would lose the buffered edits.
3. React saves every buffered task change, retries a write that failed earlier instead of waiting out its retry delay, and waits for the resulting storage commands. The window is still interactive throughout that wait, which lasts seconds whenever a write is being retried, so the buffer is flushed again after every wait, for up to `SHUTDOWN_CONFIG.maximumRendererFlushRounds` rounds: a single flush would lose whatever the user typed while the queue was still busy. The rounds are bounded because someone who keeps typing must not be able to hold the quit open forever, and because a change nothing can apply stays buffered no matter how often it is flushed. Only then does React invoke `spot-storage:pending-task-changes-flushed`.
4. Only then does the main process hide the window, refuse further commands, drain the in-flight ones, close the database, and flush the logger.

The window is hidden through the `onRendererFlushCompleted` hook, which `Main.ts` supplies, at the exact moment commands start being refused. What follows takes seconds, and all of `BACKUP_CONFIG.shutdownTimeoutMs` when the backup folder stopped answering. A window left on screen stays interactive for that whole time while every task change it collects is refused as `shutdown`, queued for a retry the process will not live to run, and lost with a warning nobody has time to read. Hiding it is what keeps the last seconds of a quit from silently dropping edits.

The renderer reports the flush as done once the rounds are used up, even when something is still buffered, because a change nothing can apply would keep the quit open forever. It writes those task IDs to the console first: the values only exist in the buffer at that point and go away with the renderer, so giving up on them is never silent.

The wait is bounded by `SHUTDOWN_CONFIG.rendererFlushTimeoutMs`, so an unresponsive or already destroyed renderer delays the quit by at most that timeout. That timeout outlasts `STORAGE_CONFIG.writeRetryDelayMs` on purpose: a write sitting on its retry delay when the quit starts must still fit in the wait, or a single transient database failure plus a quit would lose the change. When no renderer is wired at all, shutdown starts immediately and later commands are refused right away.

Closing the window runs the same handshake, through `requestRendererFlushBeforeWindowClose()`, which `Main.ts` calls from the window `close` event. Closing is the usual way of leaving the application and it destroys the renderer, on Windows and Linux before `before-quit` ever runs and on macOS without quitting at all, so the handshake cannot be left to the quit path alone. The two differ in what follows: a window close only saves the buffered edits and then destroys the window, while a quit also refuses later commands, drains, backs up, and closes the database. The window close therefore keeps accepting task commands afterwards, because the application may still be running. A window closing while a quit starts, or the other way around, joins the handshake already running instead of asking the renderer twice. A window that closes while the quit handshake is still waiting for the renderer joins it too and waits: destroying the window right away would tear the renderer down halfway through the flush the quit is waiting for, and lose whatever it had left to write. `requestRendererFlushBeforeWindowClose()` returns nothing, and the window closes immediately, only once that handshake is done or when the quit had no renderer to ask in the first place.

`installPendingTaskChangesFlushHandler()`, installed once when the renderer starts, answers that request and also saves the whole buffer on the window `pagehide` event. The page hide save is only a last resort: the renderer is being torn down at that point, so the storage commands it queues cannot all be delivered, which is exactly why the close interception exists.

## Text And Languages

Every word SPOT shows the user lives in a translation bundle under `src/i18n/lang`. Only English ships today, and there is no language picker yet, but the whole path a language takes is in place.

The framework owns the mechanism and the application owns the words:

- `src/framework/i18n/Translator.ts` creates a translator over one bundle. It resolves a dotted key, replaces `{name}` placeholders, picks a plural form, formats interpolated numbers, and joins lists.
- `src/i18n/lang/en.ts` is the bundle. It is exported `as const satisfies TranslationTree`, which is what makes English the source of truth for the key type: `t('tasks.filters.title')` autocompletes, a key that does not exist does not compile, and a key renamed in the bundle stops compiling everywhere it is used.
- `src/i18n/Translations.ts` maps a language to its bundle and creates the translator. Its `TRANSLATION_BUNDLES` values are typed as the English bundle, so a second language that is missing a key is a compile error rather than a key appearing on screen.

A second language is added by writing its bundle next to `lang/en.ts` and listing it in `TRANSLATION_BUNDLES`. Nothing else has to change.

### Plurals, Numbers And Lists

Plural forms are not a count compared against 1. A leaf may be an object of plural categories instead of a string, and the category is picked by `Intl.PluralRules` from the `count` parameter, because the categories a language has and which counts fall into them are not the same from one language to the next: Polish puts 1, 3 and 5 into three different categories that English does not have.

Interpolated numbers are formatted with `Intl.NumberFormat` in the translator's locale rather than pasted in, so grouping follows the locale. Lists of already translated fragments are joined with `translator.formatList()`, which uses `Intl.ListFormat` with `type: 'unit'`: a plain enumeration, with the locale's separator and without a trailing conjunction. The task state audit is what uses all three at once.

No library is used for any of this. Electron ships V8 with full ICU, so `Intl` already holds the rules; what a library would add over the roughly two hundred lines here is ICU MessageFormat, runtime bundle loading, and a translator-facing workflow, none of which SPOT needs yet. What it would not add is the typed keys, which are the part that actually pays for itself at this size.

### Reaching The Translator

- **Components** call `useTranslator()` from `src/i18n/TranslationContext.tsx`. `TranslationProvider` is mounted at the very top of `src/index.tsx`, above the two state contexts, because both of them word messages too.
- **Pure logic** takes what it needs as a parameter, the same way `DateUtils` takes its date labels. `createTaskStateAuditMessage()` takes the translator; `getInitialDomains()` takes only the six labels it needs, as a `DomainLabels` object, so the domain logic stays free of translation itself.
- **The renderer write queue** is created before anything mounts and words its failures whenever one happens, so it is told the language instead of asking for it: `setTaskStorageQueueTranslator()` is called from `TasksContext` when the translator changes.
- **The Electron main process** creates its own translator in `src/main/Main.ts` from `app.getLocale()`, resolved through the same `resolveSpotLanguage()` the renderer uses on `navigator.languages`. It words the native folder dialog, the message a command gets once shutdown started refusing them, the message a command gets after the database is closed, and the reasons a backup folder cannot be used. This is why `src/i18n/Translations.ts` and the bundles must stay free of React and Electron, exactly like `AppConfig`.

### What Is Not Translated

Developer-facing strings stay where they are and stay in English: log messages, `console` output, and the messages of errors only a bug can raise, such as a task field mapped to an immutable column. Translating a bug report helps nobody. The stored task values are not translated either: a priority stores `URGENT` and only its label is worded, so changing the language never touches the database.

### Changing Language At Runtime

`TranslationProvider` holds the language in state and rebuilds the translator when it changes, so everything below it re-renders in the new language. `useLanguage()` exposes the current language and the setter a picker would use. Nothing calls the setter yet. Two things are deliberately not re-worded when the language changes: messages already produced by the write queue, which describe something that happened at the time, and the labels of domain entries that came from what the user typed, which were never translated to begin with.

## Task Data Model

The current task shape is defined as a TypeScript interface in `src/types/TaskTypes.ts`:

```ts
{
	id,
	text,
	state,
	priority,
	owner,
	dueDate,
	tags,
	sortPosition,
	visible,
	completionDate
}
```

Field notes:

- `id` is a UUID string.
- `text` is free-form task content.
- `state` is `ACTIVE` or `COMPLETED`.
- `priority` is `URGENT`, `HIGH`, `NORMAL`, or `LOW`.
- `owner` is a free-form string. A missing or empty owner is displayed as `Me`.
- `dueDate` is stored as a `YYYY-MM-DD` string. A missing or empty due date is displayed as no due date.
- `tags` is an array of free-form strings. In the React task state it may also hold empty strings, which are tag inputs the user is typing into or has just emptied rather than tags. `taskToPersistedTask()` in `src/contexts/TasksContext.tsx` strips them on the way to storage, on both sides of the change comparison, so an empty tag never reaches SQLite and never looks like a change of its own.
- `sortPosition` stores manual ordering for active tasks. It is required and new tasks start at `0`.
- `visible` is derived from filters at runtime. It is required in React task state and sample/new tasks start as `false`, but it is not stored in SQLite.
- `completionDate` is set when a task is completed.

## Task State

`src/logic/TaskStateLogic.ts` coordinates task state updates. The state container has three sections:

```ts
{
	tasksContainer,
	domainsContainer,
	filters
}
```

`tasksContainer` has:

- `active`
- `completed`

`domainsContainer` has:

- `filters`, containing domains relevant to active task filters.
- `form`, containing domains available while editing tasks across active and completed tasks.

`filters` has:

- `text`
- `owners`
- `dueDates`
- `priorities`
- `tags`
- `showCompleted`

The state helpers clone top-level containers and lists before updating them. Task objects remain shared until one of their fields changes; edit, visibility, and sort helpers clone each changed task object, including mutable task fields, before writing to it.

`src/contexts/TasksContext.tsx` holds that state for the whole renderer and exposes it, the startup state, the storage status and warning, and every task action. It lives above the router on purpose:

- Tasks are loaded exactly once, when the app starts. Moving between pages never reloads the database, and never resets filters, domains, or the manual sort order.
- The startup load runs before any command can be queued, so it needs no ordering against the storage queue. A reload added later, while the user is working, would need it: it must await a bounded `waitForTaskStorageQueue()` first, so the database is not read before the queued writes are applied over it, and it must clear the storage warnings only once the reload has actually succeeded.
- Task actions read the current state through a ref, so they stay stable across renders and the applier registration never has to be torn down.

## Task UI

`TasksPage` reads `TasksContext` and renders:

- a filter pane
- an active tasks list
- a completed tasks list when `showCompleted` is enabled

The filter pane and the task lists are the two panes of a `ResizablePanes` split, so the user can give the filters as much or as little width as they want, down to the width their own heading needs. The Resizable Panes section describes how that works. The loading and startup-error states stay a plain single-pane `Page`: there are no filters to resize yet.

`TasksList`:

- filters the list down to tasks where `visible` is true
- renders list header actions for active tasks
- supports drag-and-drop reordering through `@dnd-kit/react`
- maps visible drag indices back to original task indices before moving tasks

Active list actions:

- Refresh visible tasks
- Sort active tasks by importance
- Add task

`Task`:

- owns no buffering state of its own: it renders the task from the state merged with the buffered changes held by `src/logic/PendingTaskChanges.ts`, and subscribes to them through `useSyncExternalStore`
- has no timers or lifecycle effects, so what the user typed cannot outlive or drift away from the component that shows it
- writes every edit into the buffer, and asks for an immediate save on blur and when a picker closes
- fades out for 3 seconds before the buffered state change from the completion checkbox is saved; while fading, other task controls are disabled, and changing the checkbox back before the fade completes cancels the state change and restores full opacity
- owns the generic task value setter and passes field-specific setters to task chips
- renders priority, text, owner, due date, tags, and a vertical action column with drag, completion, and delete controls

`TaskActions`:

- toggles between active and completed state
- opens a confirmation modal before deleting

`TaskChips`:

- receives dedicated owner, due date, and tags setters from `Task`
- owns the id of every chip input and hands it to both the input and its `Chip`, so that the chip icon is a real `<label>` for the input and clicking the icon focuses it. `FreeSelectInput` and `DatePicker` fall back to an id of their own when the caller does not give them one
- edits owner through `FreeSelectInput`
- edits due date through `DatePicker`
- edits every tag through `FreeSelectInput`, all of them the same way
- renders one tag input per task tag, plus a trailing empty one for the next tag whenever the last task tag is not empty already. The trailing input is derived at render time, so it is always there without the task tags having to carry it
- turns what the user types into the trailing input into a task tag right away, which is why a new empty input appears next to it as soon as they start typing
- removes a tag emptied by the user when they leave its input, wherever it is in the list. An empty tag is never persisted either, so a tag input the user has not filled in yet costs nothing
- trims owner and tag values on finish
- reuses existing capitalization when the typed value matches an existing domain case-insensitively

`TaskPriority`:

- displays the selected priority icon and color bar
- opens a priority picker on click
- flushes changes when the picker closes

## Settings

`SettingsPage` renders `BackupSettings` from `src/components/storage` and `AppInfoSettings` from `src/components/settings`. The backup section is written to make the persistence model obvious to the user, because the two folders it names mean very different things:

- The task database section states that the tasks live in a single `spot.sqlite` file inside the SPOT application folder, that this is always where they are read from and written to, and that it cannot be moved. It shows the full database path.
- The backup folder section states how often copies are written and how many are kept. Its notice states that a synchronized folder is safe to use, that SPOT never reads these copies back and does not keep two computers in sync, and then how to restore one by hand, since nothing in SPOT will: close SPOT, copy a file over the database above under that exact name, which replaces every change made after that copy was written. The restore instructions sit in that notice rather than in a section of their own, because restoring is the other half of what the notice already says about copies never being read back.

It also shows the current backup folder, a development-run notice when the run is not packaged, the reason a saved folder could not be used, the outcome of the last backup, and two actions:

- Change folder, which opens the native folder dialog.
- Use default folder, which selects the default folder of the current run.

Both actions open a `ConfirmModal` that names the current folder, the new folder, and states that the copies already written stay where they are and that the tasks are not moved. The change is applied only after confirmation, and its outcome is reported in place.

`AppInfoSettings` closes the page with the version the running application reports, which is the only thing that tells two installed copies apart. It asks the main process once when it mounts, and says the version is unknown rather than showing an empty line when there is no answer, since a missing version is never worth a warning.

## Filtering

`src/logic/FiltersLogic.ts` controls task visibility.

Current filters:

- Text search against `task.text`, using a case-insensitive plain substring match (no regex).
- Priority filter.
- Owner filter.
- Due date filter.
- Tag filter.
- Show completed toggle.

Filter behavior:

- Completed tasks are hidden unless `showCompleted` is true.
- Priority, owner, and due date filters match exact values.
- Tag filtering matches if a task has at least one selected tag.
- Active tasks are refreshed whenever filters change.
- Completed tasks are refreshed only when `showCompleted` is active or when that toggle changes.

## Domains

`src/logic/DomainsLogic.ts` builds option domains for filters and form inputs.

Persistent domains, whose labels are translated while their values are not:

- priorities: Urgent, High, Normal, Low, stored as `URGENT`, `HIGH`, `NORMAL`, `LOW`
- owner: `Me`, represented by an empty string
- due date: `None`, represented by an empty string

`getInitialDomains()` takes those six labels as a `DomainLabels` argument rather than reading them itself, so the domain logic stays pure and free of translation. `TasksContext` builds them from the translator. Every list is built fresh on each call, so the filter section and the form section count their entries independently.

Dynamic domains:

- owners found in tasks
- due dates found in active tasks for filters
- tags found in tasks

Domain entries contain:

```ts
{
	key,
	value,
	label,
	color,
	persistent,
	count
}
```

Domain counts are incremented or decremented as tasks change. Non-persistent domains are removed when their count reaches zero. Existing filters are cleaned when a selected domain value disappears. A dynamic entry takes its label from the task value itself, so it is never translated.

The two sections are kept in different orders, because the user reads them differently:

- Filter lists are a checklist read front to back, so they are sorted by value. Priorities are left in the order they are created, which is already the order they mean.
- Form lists are suggestions the user picks a single entry from, so they are sorted by descending count and then by value, putting the values the user actually uses at the top of the dropdown. Persistent entries come first whatever their count, which is what keeps the `Me` owner entry at the top: it is the default rather than a suggestion.

## Sorting

Active tasks have two sorting modes:

- Manual sort by `sortPosition`.
- Forced importance sort.

Manual sorting is implemented in `src/logic/ManuallySortedList.ts`. Items are inserted or moved by assigning a `sortPosition` between neighboring items where possible. When there is not enough numeric space, affected positions are recomputed.

Forced importance sorting is implemented in `src/logic/TasksLogic.ts`. The intended order is:

1. Priority descending: Urgent, High, Normal, Low.
2. Due date presence first.
3. Due date descending when both tasks have a due date, using the stored `YYYY-MM-DD` string order.
4. Existing manual `sortPosition` as fallback.

Completed tasks are sorted by `completionDate` descending, then by ID. A completed task stored without a completion date simply sorts last: the comparator must not assume the date is there, because throwing while the loaded tasks are sorted would fail the whole startup load and hide every other task behind a storage error.

## Dates

`src/framework/utils/DateUtils.ts` provides:

- day-level date comparison, the start of the current day, and the whole-day offset between a date and today
- smart relative labels through `toSmartString()`
- `YYYY-MM-DD` conversion for stored due dates, in both directions
- the next working day after a given day

`toSmartString(date, options)` picks the closest thing the reader recognizes: the label for today, yesterday, or tomorrow; a weekday name for the next `weekdayHorizonDays` days after tomorrow; and a full date for everything else. A label that is not supplied falls through to the next rule, so an application can name only the days it cares about. The framework owns the rules, the application owns the wording: `src/components/tasks/TaskFilters.tsx`, the only place that formats a date this way, builds those options from the translator. The labels come from the `dates` keys of the bundle and the locale comes from `translator.locale`, so the named days and the weekday and full-date wording `Intl` falls back to are always in the same language.

There is no date context and no current-date React state. `DateUtils` computes the current day when it is asked, and caches it only until the day changes, which is cheaper than holding it in a provider and cannot go stale in the way stored state does. An application left open across midnight therefore shows correct labels again on the next render, without a timer and without a provider to refresh. What remains is that nothing forces that render: a view left untouched across midnight keeps the labels it last drew until something else re-renders it.

Stored due dates are always parsed with `DateUtils.fromStandardYearMonthDay()`. The native `Date` constructor reads `YYYY-MM-DD` as UTC midnight, which shows and stores the previous day in negative UTC offsets, so it must not be used on stored due dates.

## Components

Common components:

- `Sidebar`, `SidebarElement`
- `MainContent`
- `Page`
- `Pane`
- `ResizablePanes`, `PaneDivider`
- `Header`
- `Clickable`
- `Chip`
- `ConfirmModal`
- `Tooltipped`

Input components:

- `Button`
- `ButtonsSelect`
- `Checkbox`
- `DatePicker`
- `FreeSelectInput`
- `TextArea`
- `TextInput`

`ButtonsSelect` and `FreeSelectInput` are string-valued input components. They accept simple option objects instead of app-specific domain types.

`FreeSelectInput` is a text input with a suggestion dropdown, and shows the options in the order the caller gives them:

- The dropdown exists only while it is open. The options are neither computed nor rendered otherwise, which matters because a task list renders one of these inputs per owner and per tag of every visible task, and only one of them can be open at a time.
- Every option is shown until the user types, after which the list keeps the options whose label contains what was typed, case-insensitively, minus the one that is already exactly it.
- A filtered option shows the typed part as it is and the rest of the label in bold, so what picking it would add is what stands out. The match can start anywhere in the label, so a label can have a bold part on either side of it.

`Clickable` makes anything the caller renders clickable, and carries no look of its own beyond the pointer, the disabled state and the shared focus ring. It renders a `button` and takes an optional label, which is what names a control that is only an icon, such as the task delete action. The header actions are named by the label they already show, so they pass none.

`TextArea` wraps `MDXEditor`, which reads its `markdown` property only when it mounts and ignores every later change to it. `TextArea` therefore keeps an editor reference and pushes a new value in with `setMarkdown()` when the editor does not already hold it. Without that, an editor would keep showing content that is in no task state and in no database, for instance after tasks are reloaded following a failed write. The comparison against `getMarkdown()` is what keeps the editor untouched while the user types, because the value coming back from the task state is then the one the editor just produced.

Tests replace `TextArea` with a plain `textarea` mock, so the behavior above is not covered by the automated tests. That mock was originally forced by `MDXEditor` version `4.2.0` being ESM-only, which the Jest version bundled with React Scripts could not load. Vitest loads ESM natively, so the obstacle is gone and the mock is now only a convenience: covering this behavior for real is possible whenever it is worth doing.

Icons are local React components under `src/components/icons`.

## Resizable Panes

`ResizablePanes` renders a two-pane page whose divider the user can drag, between the widths the two panes need. The task page uses it for the filters pane and the tasks pane; every other page still renders a plain `Page` with a single `Pane`. Neither pane collapses: the divider simply stops where a pane would stop showing what it holds, so nothing on screen ever has to be brought back.

The split is held as the share of the width the two panes have between them, meaning the container width without the divider, and never as a pixel width:

- Both panes are laid out with that share as their flex grow value, and the two shares always add up to one, so nothing has to be measured to render the page and resizing the window keeps the proportion the user chose.
- The two panes are exactly what the divider leaves of the page, so the width they share is measured as the sum of their own widths and the divider needs no container measurement of its own.
- `.pane` sets `min-width: 0`, because a flex item otherwise refuses to shrink below its content and the layout, not the content, is what decides how narrow a pane may get.
- `PaneDivider` draws the line that `.pane` would otherwise draw as its left border, and is wider than that line so it can be grabbed without aiming at two pixels.

How narrow a pane may get is not a constant: it is measured from the headers the pane holds, because a heading whose labels have to newline is where a pane stops being readable. `ResizablePanes` finds them by the `HEADER_LINE_CLASS_NAME` that `Header` renders, and measures what each one needs as what its own children need side by side, plus their margins. The children are measured rather than the header itself because a header in a wide pane would only report the width of that pane back, and one in a narrow pane has already clipped what did not fit. This is also why `.header-title` and `.header-action-label` are `white-space: nowrap`: it makes the measured width the width the header needs on one line, and it keeps a squeezed header from stacking its labels instead of pushing back. The title carries the same right margin as the gap between the actions, through the `--header-actions-gap` variable the header line declares, so the measured width includes that spacing and a header at its narrowest never has its title touching the first action. A pane that holds no header falls back to `PANE_LAYOUT_CONFIG.minimumPaneWidthPixels`, which is also the floor for a pane whose headers need less than that.

`clampPaneFraction()` in `src/logic/PaneLayout.ts` decides what a share is allowed to be from those measurements: neither pane is ever dragged below the width it needs, so the divider stops instead of collapsing anything. The wanted width is rounded to whole pixels first, because a share carried back and forth through a share of a width would otherwise land a fraction of a pixel outside a limit and move a pane the user dragged exactly onto it. A page too narrow to hold both panes at once has no allowed width left to pick, and the width there is then goes to the second pane, which is where the user is working; the first pane gets its own width back as soon as the window is wide enough again.

The limits are widths while the split is a proportion, so a window that just became narrower can leave the panes on a split that is not allowed anymore. `ResizablePanes` therefore clamps the current share again on the window `resize` event. Clamping is idempotent and an unchanged share notifies nobody, so that cannot loop.

The divider is a focusable `separator`: the arrow keys move it by `PANE_LAYOUT_CONFIG.keyboardStepFraction`, `Home` and `End` take the first pane as narrow and as wide as it goes, and a double click restores the default split. Dragging it puts a class on the body, because the pointer is over the panes for the whole drag and both the resize cursor and the block on text selection have to hold for the whole window.

The same `src/logic/PaneLayout.ts` holds the share of each split layout, keyed by a layout ID, outside the component tree, the way `PendingTaskChanges.ts` holds buffered task edits: leaving the page unmounts it, and the user's layout must survive that just like the task state does. It is session state on purpose. Nothing is written to disk, so every SPOT start opens on the default split, which is the one third the filters pane has always taken.

## Styling

The app uses plain CSS files next to components. Global variables live in `src/index.css`.

Theme variables include:

- background colors
- border, overlay, and shadow colors
- interaction hover and active colors
- text colors
- accent colors
- priority colors
- danger variants, warning, and disabled colors
- the Inter font family
- the focus ring

The current visual direction is dark, direct, and utilitarian.

### Focus

Every focusable control draws the same ring and none of them draws the one the browser would draw. `src/index.css` holds it as the `--focus-ring` variable and applies it to `:focus-visible` for the whole application, so a control needs no focus rule of its own:

- The ring is a `box-shadow` and not an `outline`, so that it follows whatever shape the control already has, whether or not the control has a border. That is what lets a bordered button, a borderless chip input and a checkbox all light up the same way.
- It is drawn on `:focus-visible` rather than `:focus`, so a control lights up when the keyboard reaches it and stays quiet when the pointer clicks it. A text entry field matches `:focus-visible` on a click too, which is why a field the user is about to type into does light up on a click.
- A dark hairline separates the accent ring from what it surrounds, so the ring is visible even on a control filled with the accent color, such as a selected `ButtonsSelect` option or the selected day in the date picker.

Two things follow from a single ring for everything:

- A control that draws its own focus UI has to override the shared rule and say why. `PaneDivider` is the only one: it moves the ring onto the line it draws, because a ring around its whole grab area would be a glowing column running down the page.
- A control the ring would be clipped on gets the room it needs from whatever clips it: the free-select dropdown insets its option list, and the priority picker carries horizontal padding. The picker is centered on the task border, so that padding grows it symmetrically and leaves its gradient where it is.
- A control with no room around its own content stands the ring off from it. `TextArea` is the one that needs it, because MDXEditor fills the editable area with the text: the ring is drawn by the container on a pseudo-element inset outwards from it, which stands off from the text without moving anything else on the task card.

Anything clickable is a real control and not a clickable `div`, so that the keyboard reaches it, activates it and shows the ring on it. `Clickable` is where that is enforced for the controls that are only an icon.

## Testing

Tests that cover `src/framework` live in `tests/framework` and depend only on framework modules, so they move with the folder. Tests that cover how SPOT binds to it stay under `tests/main`, `tests/logic`, and `tests/components`.

The test files are the list of what is covered, and they are named after what they cover. What follows is why each area is tested, since that is the part a file name cannot carry:

- **Pure task logic** (`tests/logic`, `tests/framework/ManuallySortedList.test.ts`) is where most of the coverage sits, because it is where a mistake is silent: sort positions, filter matching, domain counting and task cloning all produce a plausible-looking result when they are wrong.
- **The persisted shape of a task** (`TaskComparison`) is tested hard because it decides what reaches SQLite. A field the user cleared has to arrive as `undefined` so it is stored as NULL, and a difference that is never stored must not look like a change.
- **The write path** (`TaskStorageQueue`, `PendingTaskChanges`) is tested for its failure branches rather than its happy one: retries and their bounds, a refused command that must not be retried forever, later commands never overtaking a failed one, and the buffer surviving a task being filtered out, re-rendered or deleted.
- **The audit** (`TaskStateAudit`) is tested against the same comparison rules as the write path, so the two cannot disagree about what a difference is, and for never reporting one while a change has not reached storage yet.
- **Storage and the main process** (`tests/main`, the framework storage and backup tests) cover SQLite setup, row mapping, one transaction per command and its rollback, the backup file lifecycle including a copy that reopens as a valid database, and the scheduler's timing rules.
- **Shutdown** (`TaskStorageIpc`, `PendingTaskChanges`) is covered on both handshakes, quit and window close, because the buffered edits are lost if either one is wrong, and both are timing-dependent enough that a reader cannot verify them by inspection.
- **The failure nets** (`ProcessCrashHandlers`, `WindowNavigationGuard`, `ErrorBoundary`) are covered for the case that matters: that they catch, log and report rather than letting a failure vanish, and that a reporting handler which throws never replaces the failure it was reporting.
- **Translation** (`Translator`, `LanguageResolution`) covers key lookup, interpolation, plural categories a language has that English does not, and the fallbacks, so a missing key fails somewhere rather than reaching the screen.
- **Components** (`tests/components`) are smoke coverage only, on the flows where a regression would be invisible: task list and filter interaction, edit durability across re-render and unmount, task state surviving navigation, and the Settings panel saying where the database is and how to restore it.

Tests run on Vitest, configured in the `test` section of `vite.config.mts`: it reuses the same `src` alias as the build, runs in `jsdom`, and exposes `describe`, `test`, `expect` and `vi` as globals. `tests/setupTests.ts` is the shared setup file, and `tests/vitest-env.d.ts` is what makes those globals visible to TypeScript.

Components that show text need `TranslationProvider` above them, so component tests render through `renderWithTranslations()` from `tests/testUtils`. It passes the provider as the Testing Library `wrapper` rather than wrapping the element, so `rerender` keeps it in place. `makeTranslator()` and `makeDomainLabels()` in the same helper supply the English translator and the domain labels the pure logic takes. Tests assert on English wording on purpose: English is the bundle that defines the keys, so a key that stops existing has to fail somewhere.

`tests/setupTests.ts` defines a global `jest` object holding a single `advanceTimersByTime` helper that forwards to `vi`. That is not leftover Jest: Testing Library decides whether fake timers are installed by probing for a global `jest`, and without one its `findBy` queries poll on timers Vitest has already frozen and hang until the test times out. The test suite itself uses `vi` everywhere.

Validation commands:

```sh
npm run lint
npm run typecheck
npm test
```

## Development Rules

`CLAUDE.md` is the single source of truth for contributor and agent rules: hard constraints, code conventions, testing expectations, and the commit workflow. It is intentionally short so it can be read in full before any change. Do not restate those rules here; update `CLAUDE.md` instead and keep this document aligned with it.

The two rules that govern this document itself:

- Keep `README.md` minimal.
- Keep this document detailed and current, and aligned with `CLAUDE.md`.

`TODO.md` holds the outstanding work and the ideas that have not been committed to. It is not maintained here, and this document does not duplicate it: a plan written in two places goes stale in one of them.
