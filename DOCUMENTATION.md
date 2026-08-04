# SPOT Documentation

SPOT is the Simple Planner & Organizer Tool: a small Electron + React task manager intended to run on macOS, Windows, and Linux. The project is still in progress. The React renderer is considered done for now, and the initial Electron persistence layer is wired for startup loading, task mutations, shutdown draining, and packaged loading. Standalone browser mode is no longer a supported runtime.

## Current Status

- The React renderer is the primary working surface and is considered done for now.
- Task data loads through `window.spotStorage.loadTasks()` in Electron. If the renderer is opened without the Electron preload API, the task page reports storage as unavailable.
- Task changes are applied optimistically in React state. Add, edit, delete, complete, restore, manual reorder, and importance sort send storage commands through `window.spotStorage.executeTaskCommand()`.
- Main-process storage modules exist under `src/main/storage`. Configured storage initializes SQLite in the selected task database folder, owns one lazy database connection per storage instance, loads task rows, executes task write commands, writes through the process-wide operational logger, reports database health, reopens the database when the folder changes, and closes the database during shutdown. Electron exposes that boundary through storage IPC and `window.spotStorage`; React uses it for startup loading, task mutations, and non-healthy database status feedback.
- The task database folder is chosen by the user. The first startup blocks on a folder setup screen, later startups reuse the saved folder, and the Settings page can change it at any time. Configuration and log files always stay in the Electron user-data folder.
- Electron main and preload TypeScript sources are bundled by `scripts/build-electron.js` into ignored `dist/electron` files before Electron starts or packages. The bundling step uses exact-version `esbuild` to remove the former custom runtime TypeScript/module resolver.
- Electron loads the built React `build/index.html` file in both development and packaged mode. `package.json` sets CRA's `homepage` to `.` so production asset URLs stay relative under file loading.
- The Notes and Tags routes exist as placeholder pages. The Settings route owns the task database folder settings.
- The implemented persistence architecture is one SQLite database as the source of truth plus one append-only rolled `spot-logs.ndjson` operational log.
- The implemented persistence behavior is documented below. Startup loading, task mutations, shutdown draining, packaged React loading, and user-facing database health feedback are wired in Electron.

## How To Run

Install dependencies:

```sh
npm install
```

Run the Electron app:

```sh
npm start
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

`npm start`, `npm run package`, and `npm run make` build the React renderer and Electron main/preload bundles first so Electron always loads local generated files.

## Repository Map

- `CLAUDE.md` contains contributor and coding-agent instructions. Keep it aligned with this document.
- `.claude/` contains Claude Code configuration: shared tool permissions and repeatable slash commands.
- `README.md` intentionally stays minimal.
- `DOCUMENTATION.md` is this detailed project reference.
- `eslint.config.js` contains the flat ESLint configuration used by `npm run lint`.
- `scripts/build-electron.js` bundles Electron main and preload TypeScript sources into ignored `dist/electron` runtime files.
- `public/index.html` is the React renderer HTML template.
- `src/index.tsx` mounts the React app and defines routes.
- `src/index.css` defines global layout and theme variables.
- `src/config/AppConfig.ts` holds the app-wide configuration constants shared by the Electron main process and the React renderer.
- `src/main/Main.ts` resolves the runtime paths, initializes the process-wide logger, creates the task storage, registers IPC handlers, resolves the task database folder, and creates the Electron `BrowserWindow` that loads the built React renderer.
- `src/main/preload/Preload.ts` exposes the narrow renderer APIs through Electron's context bridge.
- `src/main/config/SpotRuntimePaths.ts` resolves the fixed application paths inside the Electron user-data folder and gives development runs their own root folder.
- `src/main/config/SpotConfigStore.ts` reads and writes the JSON application configuration file that stores the selected task database folder.
- `src/main/config/DatabaseLocationManager.ts` owns the task database folder: startup resolution, validation, the development override, the folder switch on task storage, and configuration persistence.
- `src/main/logging/SpotLogger.ts` configures `electron-log` behind a generic factory-created logger and exports the process-wide `spotLogger` utility with `info`, `warn`, `error`, `debug`, and `flush` methods, newline-delimited JSON output, size-based rolling, and one retained archive.
- `src/main/ipc/TaskStorageIpc.ts` registers the narrow Electron IPC surface for storage loading, task write commands, database health reporting, the shutdown flush handshake and drain for buffered and in-flight task commands, and the exclusive-access helper used while the task database folder changes. Task loading, task write commands and folder changes all run on one serial chain, so they are strictly ordered and never overlap, whichever order they are requested in.
- `src/main/ipc/DatabaseLocationIpc.ts` registers the task database folder IPC surface and opens the native folder dialog.
- `src/main/storage/TaskStorage.ts` defines the Electron main-process storage contract, configured SQLite task loading and write commands through a storage-owned database connection, database health reporting, folder switching, and shutdown preparation.
- `src/main/storage/DatabaseDirectory.ts` validates a task database folder, detects an existing `spot.sqlite` file, and creates default folders.
- `src/main/storage/TaskCommandExecutor.ts` maps task storage commands to the task repository operations and keeps each command inside one transaction.
- `src/main/storage/SpotDatabase.ts` opens `spot.sqlite`, applies schema migrations, currently creates schema version `1`, exposes a small internal query wrapper, and emits SQL query log records through the process-wide logger.
- `src/main/storage/TaskRowMapping.ts` maps between SQLite task rows and React `Task` objects and owns the shared task field to SQLite column mapping used by storage queries.
- `src/main/storage/TaskRepository.ts` owns SQLite task queries and task repository helpers that can run against an existing SPOT database wrapper or a short scoped repository session.
- `src/main/window/WindowLoadTarget.ts` resolves the built React `build/index.html` file from the Electron app root.
- `src/types` contains shared TypeScript types and constants split into semantic files for tasks, task storage, task-storage IPC channels, database location, database-location IPC channels, domains, filters, and dates. Types that have one clear owner stay in the owning `.ts` or `.tsx` file instead.
- `src/react-app-env.d.ts` contains the React Scripts TypeScript reference plus renderer-side declarations for `window.versions`, `window.spotStorage`, and `window.spotDatabaseLocation`.
- `src/components/common` contains layout and shared UI primitives.
- `src/components/inputs` contains reusable inputs.
- `src/components/tasks` contains the current task-management UI.
- `src/components/notes` and `src/components/tags` contain placeholder route pages.
- `src/components/settings` contains the Settings route page.
- `src/components/storage` contains the task database folder UI: the startup gate, the first-startup setup screen, and the Settings section.
- `src/contexts` contains app-level React contexts.
- `src/logic` contains state and domain logic, including `PendingTaskChanges.ts`, which holds the task edits the user has not saved yet, and `TaskStorageQueue.ts`, which writes them in order and retries the writes that fail.
- `src/utils` contains general utilities.
- `tests` contains Jest tests, test setup, and test-only helpers.

## Source Imports

React source files use absolute imports rooted at `src/...`, including local CSS imports, instead of relative `./` or `../` paths. `tsconfig.json` sets `baseUrl` to the repository root so TypeScript, React Scripts, Jest, and ESLint can resolve those imports consistently.

## Configuration

`src/config/AppConfig.ts` is the single place for app-wide configuration constants: sizes, delays, retry policies, and file or directory names that would otherwise be magic numbers spread across modules. Both the Electron main process and the React renderer import from it, so the file must stay free of Node and Electron imports.

The exported groups are:

- `WINDOW_CONFIG`: `BrowserWindow` size, the preload script file name, and the built React index path segments.
- `STORAGE_CONFIG`: the default storage directory name, the SQLite database file name, the current schema version, the SQLite connection timeout, and the delay before a failed task write is retried.
- `APP_CONFIG_FILE`: the development root directory name and the application configuration file name.
- `LOGGING_CONFIG`: the log directory name, the operational log file name, maximum file size, retained archive count, maximum write attempts, and retry delay.
- `TASKS_CONFIG`: the task flush delay, the task state change delay, and the manual sort position step.
- `SHUTDOWN_CONFIG`: the bounded time the main process waits for the renderer to flush its buffered task changes before quitting.

Each group is declared `as const`, so consumers that pass a value to a widened parameter may need an explicit type annotation. User-facing and error message strings are not configuration and stay in the module that owns them.

## Application Shell

`src/index.tsx` renders:

- `DatesContextProvider`
- `DatabaseLocationContextProvider`
- `DatabaseLocationGate`
- `HashRouter`
- `Sidebar`
- `MainContent`
- routes for Tasks, Notes, Tags, and Settings

Routes:

- `/` renders `TasksPage`
- `/notes` renders `NotesPage`
- `/tags` renders `TagsPage`
- `/settings` renders `SettingsPage`

`DatabaseLocationGate` renders the rest of the app only when a usable task database folder is configured. While the folder is missing or unavailable it renders `DatabaseLocationSetup` instead, so a first startup or an unreachable folder can never fall back to another database.

The page layout is a fixed-height flex app:

- `#root` is a horizontal flex container.
- `Sidebar` stays on the side.
- `MainContent` renders the selected route.
- `Page` and `Pane` build the page-level split layout.

## Electron Layer

`package.json` points Electron at `dist/electron/main.js`, which is generated from `src/main/Main.ts` by `npm run build-electron`. The build script bundles `src/main/Main.ts` and `src/main/preload/Preload.ts` with `esbuild`, preserving external Electron and `electron-log` imports while resolving in-repository `src/...` imports at build time.

`src/main/Main.ts` resolves the runtime paths with `resolveSpotRuntimePaths()` and initializes `spotLogger` as soon as Electron is ready. It then creates the task storage, registers a sample `ping` IPC handler, the storage IPC handlers from `src/main/ipc/TaskStorageIpc.ts`, which also attach the storage shutdown drain to Electron's `before-quit` event, and the database location handlers from `src/main/ipc/DatabaseLocationIpc.ts`. It resolves the task database folder through `DatabaseLocationManager.initialize()` before creating the `BrowserWindow`. It uses `resolveWindowLoadTarget()` from `src/main/window/WindowLoadTarget.ts` to load the built React `build/index.html` file through `loadFile()` in both development and packaged mode.

`src/main/preload/Preload.ts` exposes a `window.versions` API with Node, Chrome, Electron, and `ping` helpers. It also exposes the narrow `window.spotStorage` and `window.spotDatabaseLocation` APIs documented in the Persistence section. It does not expose raw `ipcRenderer`, filesystem, SQLite, or dialog objects. Shared IPC channel names live in `src/types/TaskStorageIpcChannels.ts` and `src/types/DatabaseLocationIpcChannels.ts` so preload and main-process handlers cannot drift.

Known Electron work still pending:

- Add robust save, reload, and error handling polish.

## Persistence

SPOT persists tasks only in Electron runtime. The Electron main process owns durable storage, operational logging, and database health, while React owns the responsive in-memory task state used by the UI. The renderer requires `window.spotStorage` and `window.spotDatabaseLocation` on startup; opening the React build outside Electron reports storage as unavailable.

SQLite is the source of truth for task reads and writes. The append-only operational log is a diagnostic trace of storage commands and SQL activity; startup never rebuilds task state from the log. Google Drive or similar filesystem sync should be treated as backup or cross-device handoff, not live collaborative database replication.

### Storage Files

The task database folder is chosen by the user and can be any readable and writable folder, including a Google Drive, OneDrive, or Dropbox synced folder. It contains only:

- `spot.sqlite`: the canonical task database.

Application configuration and logs never follow that folder. `src/main/config/SpotRuntimePaths.ts` keeps them inside the Electron user-data folder:

| Path | Packaged run | Development run |
| --- | --- | --- |
| Configuration file | `<userData>/spot-config.json` | `<userData>/dev/spot-config.json` |
| Log directory | `<userData>/logs` | `<userData>/dev/logs` |
| Default database folder | `<userData>/storage` | `<userData>/dev/storage` |

The log directory contains:

- `spot-logs.ndjson`: newline-delimited operational log entries.
- `spot-logs.old.ndjson`: the single retained rolled log archive.

Without a configured database folder, `createTaskStorage()` reports the database as `not-configured`, and the renderer blocks on the folder setup screen instead of loading tasks.

### Task Database Folder

`src/main/config/DatabaseLocationManager.ts` owns the selected folder and reports it as a `DatabaseLocation` with `state`, `directory`, `defaultDirectory`, `isDevelopment`, and an optional `message`.

Startup resolution:

- A packaged run reads `databaseDirectory` from the configuration file. A saved folder that exists and is readable and writable is opened without asking the user again.
- A packaged run with no saved folder, or with a saved folder that no longer exists or cannot be used, reports `unconfigured`, and the folder that failed is explained in `message`. A missing folder is never recreated silently.
- A development run always restarts on `<userData>/dev/storage`, creating it when needed and ignoring the folder saved during a previous development session. Changing the folder from Settings still works for testing, and it is written to the development configuration file only.

Changing the folder, from the setup screen or from Settings:

1. The folder is validated. The native folder dialog is opened by `src/main/ipc/DatabaseLocationIpc.ts` with `openDirectory` and `createDirectory`, and it reports whether the folder already contains `spot.sqlite`.
2. React writes everything it still has buffered or queued for the current database before asking for the switch, so no task command can still be on its way. `runExclusively()` from the storage IPC controller then puts the switch on the serial storage chain, so it runs after the task commands already on it and before the ones that arrive later, and a second folder change waits for the first to finish instead of interleaving with it.
3. `TaskStorage.openStorageDirectory()` closes the old SQLite connection and opens the new one, creating an empty database when the folder has no `spot.sqlite` file.
4. The new folder is saved in the configuration file, and React reloads all tasks from the new database. When the new folder cannot be opened, the previous folder is reopened, the configuration is left untouched, and the failure message is shown.

The renderer uses the narrow `window.spotDatabaseLocation` API:

- `getDatabaseLocation()` returns the current `DatabaseLocation`.
- `chooseDatabaseDirectory()` opens the native folder dialog and returns the chosen folder, whether it already contains a database, or a cancelled or invalid result.
- `setDatabaseDirectory(directory)` applies and saves a folder.
- `setDefaultDatabaseDirectory()` creates the default folder if needed, then applies and saves it.

### SQLite Schema

`src/main/storage/SpotDatabase.ts` opens or creates `spot.sqlite` using Electron's bundled Node `node:sqlite` support. No external SQLite dependency is used. The raw SQLite connection stays private to `SpotDatabase.ts`; task storage uses wrapper methods for SQL execution, row reads, and transactions. `createTaskStorage({ storageDirectory })` owns one lazy database wrapper, opens it on the first status, load, or write operation, reuses it across storage calls, replaces it on `openStorageDirectory()`, and closes it from `prepareForShutdown()`.

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
- `window.spotStorage.notifyPendingTaskChangesFlushed()` invokes `spot-storage:pending-task-changes-flushed` to report that the buffered task changes reached storage.

Supported write commands are:

- `task.create`
- `task.update`
- `task.delete`
- `tasks.updateMany`

Completing and restoring tasks are represented as `task.update` commands because they update `state` and `completionDate`. Manual reorder and sort by importance use `tasks.updateMany` with a `reason`, such as `manual-reorder` or `importance-sort`.

Each configured task write command runs in exactly one SQLite transaction on the storage-owned connection. Bulk changes must not be split into per-task transactions. Transactions are opened with `BEGIN IMMEDIATE`, never a plain deferred `BEGIN`: the write lock is taken upfront so a concurrent writer on the same database file cannot make the transaction fail with an unrecoverable `SQLITE_BUSY` while it upgrades from a read to a write. The busy handler installed through `STORAGE_CONFIG.databaseTimeoutMs` can then retry the initial lock acquisition normally. Fields marked immutable in `TASK_FIELD_COLUMN_MAPPINGS`, currently `id`, cannot be included in update changes. If an update or delete references a missing task row, the command fails and the transaction rolls back. Task durability is immediate and does not rely on delayed batching.

`readTasksFromDatabase()` in `src/main/storage/TaskRepository.ts` maps each row independently: a row that fails mapping (unrecognized `state`/`priority`, or malformed `tags_json`) is skipped and logged with `spotLogger.warn()` rather than failing the whole load, so one corrupt row cannot hide every other task behind a storage-unavailable state.

### Renderer Behavior

React calls `loadTasks()` through `window.spotStorage` on startup, and again whenever the selected task database folder changes, and calls `executeTaskCommand()` for task mutations. It updates optimistically for normal task changes, keeps the latest renderer-facing `StorageStatus`, stays quiet while the database is healthy, shows startup storage failures before rendering task lists, and shows a prominent save warning when writes fail.

### Writing Task Changes

`src/logic/TaskStorageQueue.ts` owns every task write. Commands are queued and written one at a time and in order, so a write that fails cannot be overtaken by later ones.

- A write that fails with `database-error`, or whose call throws, stays at the front of the queue and is retried every `STORAGE_CONFIG.writeRetryDelayMs`. A database that failed once can work again, and the change is not lost in the meantime.
- A write refused as `invalid-command` would be refused again in exactly the same way, so it is dropped instead of retried.
- A failed write does not touch the task state. The state holds what the user wanted, and reading the database back over it would throw that away, so React keeps it and only warns. There is no reconciliation and no reload after a write failure.
- The warning lives as long as the change is unwritten: it is cleared when the queue drains, never by an unrelated command that happened to succeed. A dropped command keeps warning until tasks are loaded again, because that change will never be written.
- Successful writes are silent. There is no saving or saved indicator.

The renderer waits for that queue to drain before it lets the task database folder change, so a command already on its way to the main process cannot be applied to the newly opened database, where its task does not exist.

### Buffered Task Changes

Task edits are not sent to the task state on every keystroke. `src/logic/PendingTaskChanges.ts` holds them in a buffer keyed by task ID, outside the component tree, so that they cannot be lost when a task component re-renders, is filtered out, or unmounts.

- Task components read the buffer through `useSyncExternalStore` and render the task state merged with it. The rendered value is derived from both on every render, so the inputs and the task state can never drift apart.
- Only the components of the edited task re-render while the user types, because subscribers are registered per task ID.
- A buffered change is saved after `TASKS_CONFIG.flushDelayMs`, or after the shorter `TASKS_CONFIG.stateChangeDelayMs` when it is a pending state change. Every new change restarts the delay, and a value brought back to the one already in the task state is dropped from the buffer.
- `TasksPage` registers the single applier that saves buffered changes. It looks the task up by ID in the current task state, so changes are always applied to the task as it is at save time, and a task that no longer exists is skipped.
- `TasksPage` clears the buffer of a deleted task, and saves everything still buffered when it unmounts, before unregistering the applier.
- The trailing tag input is buffered as `newTag` and is not a task change until it is committed. Delayed and explicit saves leave it alone, because the user may still be typing; only the final flush of the whole buffer turns it into a tag.
- Buffered changes are never dropped when no applier is registered: they stay buffered until one is.

`StorageStatus` reports the database state as `not-configured`, `healthy`, or `unavailable`, plus the configured `storageDirectory` and `databasePath` when available. Storage failures use `not-implemented`, `database-error`, `invalid-command`, or `shutdown`.

### Operational Logging

`src/main/logging/SpotLogger.ts` uses `electron-log` version `5.4.4` to write newline-delimited JSON entries to `spot-logs.ndjson` inside the log directory of the current run. The dependency is wrapped by `createSpotLogger()`, while `initializeSpotLogger()` installs the concrete logger behind the process-wide `spotLogger` utility. Main-process code can call `spotLogger.info`, `spotLogger.warn`, `spotLogger.error`, `spotLogger.debug`, and `spotLogger.flush` without depending on `electron-log` directly or constructing a logger itself.

The main process logs every incoming React storage command and every SQL query run by the storage layer, including `SELECT` queries. SQL log entries include the query text, `elapsedMillis`, and success or failure. Query parameters should be logged only when they are useful for debugging and safe to write to disk.

Example entries:

```json
{"createdAt":"2026-06-02T12:00:00.000Z","level":"info","message":"React storage command received","type":"react.command","command":"task.update","payload":{"taskId":"...","change":{"text":"New"}}}
{"createdAt":"2026-06-02T12:00:00.001Z","level":"info","message":"React storage command received","type":"react.command","command":"tasks.updateMany","payload":{"reason":"manual-reorder","updates":[{"taskId":"...","change":{"sortPosition":1000}},{"taskId":"...","change":{"sortPosition":2000}}]}}
{"createdAt":"2026-06-02T12:00:00.003Z","level":"info","message":"Storage SQL query completed","type":"sql.query","query":"UPDATE tasks SET text = ? WHERE id = ?","elapsedMillis":2.4,"result":"success"}
```

Logger write methods return `void`; normal callers do not await operational logging or inspect write outcomes. The file transport writes only JSON lines, uses a 1 MiB maximum file size, and keeps one rolled archive so logs cannot grow without limit. Runtime log write failures are retried for a bounded time and then ignored when SQLite succeeds. `flush()` is reserved for shutdown preparation and waits for already pending write attempts to finish their bounded retries.

### Failure And Shutdown

Database write failures are user-facing. The SQLite transaction must not partially commit and the main process reports the failure to React, which keeps the task state, retries the write, and warns the user. Database read or startup failures are also user-facing; React receives a storage error state instead of silently falling back to stale persisted data.

Operational-log failures are not renderer-facing. Startup log file open failures are tracked internally by `SpotLogger`, and runtime log write failures are ignored after bounded retries when SQLite succeeds. Storage folder failures must leave persistence visibly non-healthy rather than pretending data is saved.

`src/main/ipc/TaskStorageIpc.ts` registers a `before-quit` drain. The first quit request waits for in-flight task write commands, calls `prepareForShutdown()` so the SQLite connection closes, flushes the process-wide logger so pending log retries can settle or be abandoned according to the bounded retry policy, and then resumes quitting. New write commands after shutdown begins return a `shutdown` failure instead of being enqueued behind the quit drain.

React buffers task edits for a few seconds, so the quit drain would close the database while the user's last keystrokes are still in the renderer. The first quit request therefore starts with a renderer flush handshake:

1. The main process sends `spot-storage:flush-pending-task-changes` to the window and waits.
2. Task write commands keep being accepted during that wait, because refusing them is exactly what would lose the buffered edits.
3. React saves every buffered task change, waits for the resulting storage commands, and invokes `spot-storage:pending-task-changes-flushed`.
4. Only then does the main process refuse further commands, drain the in-flight ones, close the database, and flush the logger.

The wait is bounded by `SHUTDOWN_CONFIG.rendererFlushTimeoutMs`, so an unresponsive or already destroyed renderer delays the quit by at most that timeout. When no renderer is wired at all, shutdown starts immediately and later commands are refused right away.

`installPendingTaskChangesFlushHandler()`, installed once when the renderer starts, answers that request and also saves the whole buffer on the window `pagehide` event, so closing the window while the application keeps running still saves what the user typed.

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
- `tags` is an array of free-form strings.
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

## Task UI

`TasksPage` owns the task state and renders:

- a filter pane
- an active tasks list
- a completed tasks list when `showCompleted` is enabled

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
- edits owner through `FreeSelectInput`
- edits due date through `DatePicker`
- edits existing tags through `FreeSelectInput`
- provides a trailing empty tag input for adding a new tag
- trims owner and tag values on finish
- reuses existing capitalization when the typed value matches an existing domain case-insensitively

`TaskPriority`:

- displays the selected priority icon and color bar
- opens a priority picker on click
- flushes changes when the picker closes

## Settings

`SettingsPage` renders `DatabaseLocationSettings` from `src/components/storage`. That section shows the current task database folder, a development-run notice when the run is not packaged, and two actions:

- Change folder, which opens the native folder dialog.
- Use default folder, which selects the default folder of the current run.

Both actions open a `ConfirmModal` that names the current folder, the new folder, whether that folder already contains a SPOT database, and what happens to pending task changes. The change is applied only after confirmation, and its outcome is reported in place.

`DatabaseLocationSetup` reuses the same two actions on the blocking first-startup screen, without the confirmation step, and shows the reason why a previously saved folder could not be used.

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

Persistent domains:

- priorities: Urgent, High, Normal, Low
- owner: `Me`, represented by an empty string
- due date: `None`, represented by an empty string

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

Domain counts are incremented or decremented as tasks change. Non-persistent domains are removed when their count reaches zero. Existing filters are cleaned when a selected domain value disappears.

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

Completed tasks are sorted by `completionDate` descending, then by ID.

## Dates

`DatesContextProvider` computes date labels once when the app mounts:

- Today
- Yesterday
- Tomorrow
- five weekday labels after tomorrow
- next working day

`DateUtils` provides:

- day-level date comparison
- smart date labels for task chips and filters
- `YYYY-MM-DD` conversion for stored due dates, in both directions

Stored due dates are always parsed with `DateUtils.fromStandardYearMonthDay()`. The native `Date` constructor reads `YYYY-MM-DD` as UTC midnight, which shows and stores the previous day in negative UTC offsets, so it must not be used on stored due dates.

Known limitation: the date context does not currently update at midnight.

## Components

Common components:

- `Sidebar`, `SidebarElement`
- `MainContent`
- `Page`
- `Pane`
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

`TextArea` wraps `MDXEditor`, which reads its `markdown` property only when it mounts and ignores every later change to it. `TextArea` therefore keeps an editor reference and pushes a new value in with `setMarkdown()` when the editor does not already hold it. Without that, an editor would keep showing content that is in no task state and in no database, for instance after tasks are reloaded following a failed write. The comparison against `getMarkdown()` is what keeps the editor untouched while the user types, because the value coming back from the task state is then the one the editor just produced.

`MDXEditor` version `4.0.0` is ESM-only and cannot be loaded by the Jest version that React Scripts `5.0.1` provides, so tests replace `TextArea` with a plain `textarea` mock and this behavior is not covered by the automated tests.

Icons are local React components under `src/components/icons`.

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

The current visual direction is dark, direct, and utilitarian.

## Testing

Current test coverage includes focused regression checks for:

- insertion at start, middle, and end
- manual sort position recomputation, move operations, and random operation checks
- task shallow cloning, task loading, importance sorting, state changes, and new-task defaults
- filter cloning and task visibility matching
- domain counting, active/filter domain separation, and selected-filter cleanup
- date comparison and display formatting
- smoke coverage for task filters and task list interactions
- SQLite storage setup, task row mapping, command execution, transaction rollback, and optional operational logging behavior
- storage IPC handler registration, channel delegation, shutdown drain, post-shutdown command failure behavior, exclusive storage-folder switching that finalizes in-flight commands and queues later ones, and two overlapping folder changes running one after the other with no command in between
- the shutdown flush handshake: buffered renderer changes saved before the database is closed, commands refused only after the renderer reported, and a bounded wait when the renderer never reports
- the buffered task changes: save delays and their restart, immediate saves, forgetting a reverted value, the shorter state change delay, updater-form changes, dropping the buffer of a deleted task, committing the trailing tag input only on the final save, keeping changes when no applier is registered, per-task subscriber notification with stable snapshots, page hide saving, waiting for in-flight storage commands, and reporting to the main process only once storage caught up
- runtime path resolution for packaged and development runs
- task database folder resolution at startup, saved-folder reuse, re-prompting on an unavailable folder, the development folder override, folder changes with configuration persistence, and fallback to the previous folder when the new one cannot be opened
- database location IPC registration, cancelled folder dialogs, and existing-database detection
- smoke coverage for the blocking first-startup folder setup and for the confirmed folder change in Settings
- Electron window load-target resolution for local built React loading
- React task-page startup loading, Electron preload API requirement, persisted Electron loading, and startup-error rendering
- React task-page storage commands for create, update, delete, complete, restore, manual reorder, and importance sort, plus the write-failure warning, storage-health feedback, and the task state being kept as it is after a rejected write
- the task write queue: in-order writing, retrying a failed or thrown write while keeping the warning until it goes through, later commands not overtaking a failed one, dropping a refused command instead of retrying it forever, keeping a dropped command's warning through later successful writes, and database status reporting
- task edit durability corner cases: edits still saved after the task is filtered out of the list, never saved for a deleted task, task state values shown again when the parent replaces the task, what the user is typing kept while the parent replaces the task, the trailing tag input saved when the task disappears, and everything saved before the renderer goes away
- generic SPOT logging success, public log levels, startup file-open failures, bounded retry failures, retry recovery, shutdown flush behavior, and size-based rolling with bounded retention

Validation commands:

```sh
npm run lint
npm run typecheck
npm test
```

Future testing priorities:

- broader interaction coverage as task editing and drag-and-drop behavior are polished
- Electron-shell integration coverage for persisted startup, mutation, shutdown, and packaged loading flows

## Development Rules

`CLAUDE.md` is the single source of truth for contributor and agent rules: hard constraints, code conventions, testing expectations, and the commit workflow. It is intentionally short so it can be read in full before any change. Do not restate those rules here; update `CLAUDE.md` instead and keep this document aligned with it.

The two rules that govern this document itself:

- Keep `README.md` minimal.
- Keep this document detailed and current, and aligned with `CLAUDE.md`.

## Near-Term Work

The most important remaining work is:

- Add persistence and Electron-shell integration tests for runtime startup, mutation, shutdown, and packaged loading flows.
- Improve accessibility and focus behavior in reusable inputs and clickables.
- Continue polishing drag-and-drop feedback as the task interaction model settles.
- Make `DatesContextProvider` refresh date labels after midnight.
- Continue polishing reload feedback.
- Finish Notes and Tags pages, and the rest of the Settings page, when their scope is clear.
