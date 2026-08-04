# SPOT Documentation

SPOT is the Simple Planner & Organizer Tool: a small Electron + React task manager intended to run on macOS, Windows, and Linux. The project is still in progress. The React renderer is considered done for now, and the initial Electron persistence layer is wired for startup loading, task mutations, shutdown draining, packaged loading, and rotated database backups. Standalone browser mode is no longer a supported runtime.

## Current Status

- The React renderer is the primary working surface and is considered done for now.
- Task data loads through `window.spotStorage.loadTasks()` in Electron. If the renderer is opened without the Electron preload API, the task page reports storage as unavailable.
- Task changes are applied optimistically in React state. Add, edit, delete, complete, restore, manual reorder, and importance sort send storage commands through `window.spotStorage.executeTaskCommand()`.
- Main-process storage modules exist under `src/main/storage`. Storage initializes SQLite in the local database folder, owns one lazy database connection per storage instance, loads task rows, executes task write commands, writes through the process-wide operational logger, reports database health, writes rotated backup copies, and closes the database during shutdown. Electron exposes that boundary through storage IPC and `window.spotStorage`; React uses it for startup loading, task mutations, non-healthy database status feedback, and backup failure notices.
- The database always lives in the Electron user-data folder and cannot be moved. The user only chooses the backup folder, which receives rotated write-only copies of the database and defaults to `<userData>/backups`. Startup never blocks on a folder choice. Configuration and log files also always stay in the Electron user-data folder.
- Electron main and preload TypeScript sources are bundled by `scripts/build-electron.js` into ignored `dist/electron` files before Electron starts or packages. The bundling step uses exact-version `esbuild` to remove the former custom runtime TypeScript/module resolver.
- Electron loads the built React `build/index.html` file in both development and packaged mode. `package.json` sets CRA's `homepage` to `.` so production asset URLs stay relative under file loading.
- The Notes and Tags routes exist as placeholder pages. The Settings route owns the database and backup folder settings.
- The implemented persistence architecture is one local SQLite database as the source of truth, one append-only rolled `spot-logs.ndjson` operational log, and a rotated set of backup copies in the backup folder.
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
- `src/main/Main.ts` resolves the runtime paths, initializes the process-wide logger, creates the task storage, registers IPC handlers, creates the backup scheduler, resolves the backup folder, and creates the Electron `BrowserWindow` that loads the built React renderer.
- `src/main/preload/Preload.ts` exposes the narrow renderer APIs through Electron's context bridge.
- `src/main/config/SpotRuntimePaths.ts` resolves the fixed application paths inside the Electron user-data folder, including the database folder and the default backup folder, and gives development runs their own root folder.
- `src/main/config/SpotConfigStore.ts` reads and writes the JSON application configuration file that stores the selected backup folder.
- `src/main/config/BackupLocationManager.ts` owns the backup folder: startup resolution, validation, the development override, the fallback to the default folder, and configuration persistence.
- `src/main/logging/SpotLogger.ts` configures `electron-log` behind a generic factory-created logger and exports the process-wide `spotLogger` utility with `info`, `warn`, `error`, `debug`, and `flush` methods, newline-delimited JSON output, size-based rolling, and one retained archive.
- `src/main/ipc/TaskStorageIpc.ts` registers the narrow Electron IPC surface for storage loading, task write commands, database health reporting, the shutdown flush handshake and drain for buffered and in-flight task commands, the shutdown backup hook, and the exclusive-access helper shared with the backup folder change. Task loading, task write commands, backups and folder changes all run on one serial chain, so they are strictly ordered and never overlap, whichever order they are requested in.
- `src/main/ipc/BackupLocationIpc.ts` registers the backup folder IPC surface and opens the native folder dialog.
- `src/main/storage/TaskStorage.ts` defines the Electron main-process storage contract, SQLite task loading and write commands through a storage-owned database connection, database health reporting, backup execution and backup status, and shutdown preparation.
- `src/main/storage/BackupDirectory.ts` validates a backup folder and creates it when it is missing.
- `src/main/storage/DatabaseBackup.ts` writes one rotated backup copy: `VACUUM INTO` a local temporary file, publish it into the backup folder through a partial file and an atomic rename, then prune the folder down to the retained backup count.
- `src/main/storage/BackupScheduler.ts` decides when a backup runs: after the task changes have settled, once more at shutdown under a bounded timeout, and never twice at the same time.
- `src/main/storage/TaskCommandExecutor.ts` maps task storage commands to the task repository operations and keeps each command inside one transaction.
- `src/main/storage/SpotDatabase.ts` opens `spot.sqlite` in write-ahead logging mode, applies schema migrations, currently creates schema version `1`, exposes a small internal query wrapper including the backup `VACUUM INTO` helper, and emits SQL query log records through the process-wide logger.
- `src/main/storage/TaskRowMapping.ts` maps between SQLite task rows and React `Task` objects and owns the shared task field to SQLite column mapping used by storage queries.
- `src/main/storage/TaskRepository.ts` owns SQLite task queries and task repository helpers that can run against an existing SPOT database wrapper or a short scoped repository session.
- `src/main/window/WindowLoadTarget.ts` resolves the built React `build/index.html` file from the Electron app root.
- `src/types` contains shared TypeScript types and constants split into semantic files for tasks, task storage, task-storage IPC channels, backup location, backup-location IPC channels, domains, filters, and dates. Types that have one clear owner stay in the owning `.ts` or `.tsx` file instead.
- `src/react-app-env.d.ts` contains the React Scripts TypeScript reference plus renderer-side declarations for `window.versions`, `window.spotStorage`, and `window.spotBackupLocation`.
- `src/components/common` contains layout and shared UI primitives.
- `src/components/inputs` contains reusable inputs.
- `src/components/tasks` contains the current task-management UI.
- `src/components/notes` and `src/components/tags` contain placeholder route pages.
- `src/components/settings` contains the Settings route page.
- `src/components/storage` contains the Settings section that explains where the database lives and lets the user choose the backup folder.
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
- `STORAGE_CONFIG`: the database directory name, the SQLite database file name, the current schema version, the SQLite connection timeout, and the delay before a failed task write is retried.
- `BACKUP_CONFIG`: the default backup directory name, the backup file prefix and extension, the partial and temporary file names used while a backup is being written, the delay after the last task change before a backup runs, the number of retained backups, and the bounded time the shutdown backup is given.
- `APP_CONFIG_FILE`: the development root directory name and the application configuration file name.
- `LOGGING_CONFIG`: the log directory name, the operational log file name, maximum file size, retained archive count, maximum write attempts, and retry delay.
- `TASKS_CONFIG`: the task flush delay, the task state change delay, and the manual sort position step.
- `SHUTDOWN_CONFIG`: the bounded time the main process waits for the renderer to flush its buffered task changes before quitting.

Each group is declared `as const`, so consumers that pass a value to a widened parameter may need an explicit type annotation. User-facing and error message strings are not configuration and stay in the module that owns them.

## Application Shell

`src/index.tsx` renders:

- `DatesContextProvider`
- `BackupLocationContextProvider`
- `HashRouter`
- `Sidebar`
- `MainContent`
- routes for Tasks, Notes, Tags, and Settings

Routes:

- `/` renders `TasksPage`
- `/notes` renders `NotesPage`
- `/tags` renders `TagsPage`
- `/settings` renders `SettingsPage`

Nothing gates the app at startup: the database is always in the user-data folder, so the task page renders right away and the backup folder is only a Settings concern.

The page layout is a fixed-height flex app:

- `#root` is a horizontal flex container.
- `Sidebar` stays on the side.
- `MainContent` renders the selected route.
- `Page` and `Pane` build the page-level split layout.

## Electron Layer

`package.json` points Electron at `dist/electron/main.js`, which is generated from `src/main/Main.ts` by `npm run build-electron`. The build script bundles `src/main/Main.ts` and `src/main/preload/Preload.ts` with `esbuild`, preserving external Electron and `electron-log` imports while resolving in-repository `src/...` imports at build time.

`src/main/Main.ts` resolves the runtime paths with `resolveSpotRuntimePaths()` and initializes `spotLogger` as soon as Electron is ready. It then creates the task storage on the runtime database folder, registers a sample `ping` IPC handler, the storage IPC handlers from `src/main/ipc/TaskStorageIpc.ts`, which also attach the storage shutdown drain to Electron's `before-quit` event, the backup scheduler, and the backup location handlers from `src/main/ipc/BackupLocationIpc.ts`. It resolves the backup folder through `BackupLocationManager.initialize()` before creating the `BrowserWindow`. It uses `resolveWindowLoadTarget()` from `src/main/window/WindowLoadTarget.ts` to load the built React `build/index.html` file through `loadFile()` in both development and packaged mode.

Every window `Main.ts` creates also intercepts its own `close` event with `requestRendererFlushBeforeWindowClose()` from the storage IPC handlers: the close is prevented, the renderer flush handshake runs, and the window is destroyed only once the renderer reported or the handshake timed out. Without it the buffered task edits would be lost on the usual way of closing the application, because closing the window destroys the renderer before `before-quit` runs on Windows and Linux and without quitting at all on macOS.

The scheduler and the storage IPC handlers need each other: the handlers return the serial storage chain the scheduler runs backups on, and the scheduler provides the callbacks the handlers use to restart the backup delay after an applied command and to run the shutdown backup. `Main.ts` resolves that by registering the handlers first with callbacks that read a scheduler variable assigned right afterwards.

`src/main/preload/Preload.ts` exposes a `window.versions` API with Node, Chrome, Electron, and `ping` helpers. It also exposes the narrow `window.spotStorage` and `window.spotBackupLocation` APIs documented in the Persistence section. It does not expose raw `ipcRenderer`, filesystem, SQLite, or dialog objects. Shared IPC channel names live in `src/types/TaskStorageIpcChannels.ts` and `src/types/BackupLocationIpcChannels.ts` so preload and main-process handlers cannot drift.

Known Electron work still pending:

- Add robust save, reload, and error handling polish.

## Persistence

SPOT persists tasks only in Electron runtime. The Electron main process owns durable storage, operational logging, database health, and backups, while React owns the responsive in-memory task state used by the UI. The renderer requires `window.spotStorage` and `window.spotBackupLocation` on startup; opening the React build outside Electron reports storage as unavailable.

SQLite is the source of truth for task reads and writes. The append-only operational log is a diagnostic trace of storage commands and SQL activity; startup never rebuilds task state from the log.

### Local Database And Backup Folder

The live database always lives on the local user-data disk and is never placed in a folder that a synchronization client controls. This is the design decision the rest of the persistence layer depends on:

- A synchronization client replaces files behind the process holding them open. When it does so through the usual unlink-and-rename, the SQLite connection keeps reading and writing an unlinked inode: every write reports success and the whole session is lost on quit. Keeping the database local removes that failure entirely.
- Because the database is local, write-ahead logging is safe to use, and its `-wal` and `-shm` companion files never have to be understood by a synchronization client.
- The backup folder only ever receives finished files. Each backup is built locally and published with an atomic rename, so a synchronization client watching that folder cannot observe a database that is still being written.

The backup folder is therefore a write-only destination. SPOT never reads a backup back, never compares one against the live database, and does not keep two computers in sync. Restoring a backup is a manual step: copy the chosen file over `spot.sqlite` in the database folder while SPOT is closed.

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
- `spot-logs.old.ndjson`: the single retained rolled log archive.

The backup folder contains up to `BACKUP_CONFIG.retainedBackupCount` files named `spot-backup-<timestamp>.sqlite`. The timestamp is the ISO instant with colons and dots replaced, so the files sort chronologically by name. Anything else the user keeps in that folder is left alone.

### Backups

`src/main/storage/DatabaseBackup.ts` writes one backup:

1. `VACUUM INTO` a temporary file in the local database folder. This is the only step that touches the database, it runs in its own read transaction, and it produces a complete self-contained database with no journal and no write-ahead log. A plain file copy is not used: it would capture a database mid-transaction, and under write-ahead logging it would silently miss everything still in `spot.sqlite-wal`.
2. Copy that inert file into the backup folder under a `.part` name. Nothing is writing to the source, so this copy is safe however slow the destination is.
3. Rename the `.part` file to its final name. The rename is atomic within the folder.
4. Prune the folder down to the retained backup count, oldest first.

A `.part` file left behind by an interrupted backup is cleared at the start of the next run. Steps 2 to 4 are asynchronous on purpose, so the shutdown timeout can actually abandon a backup whose destination has become slow or unreachable.

`src/main/storage/BackupScheduler.ts` decides when that runs:

- Every applied task command restarts a `BACKUP_CONFIG.delayAfterChangeMs` timer, so a burst of edits produces one backup once the user has stopped, not one per edit.
- Backups run through `runExclusively()` on the serial storage chain, so a snapshot is never taken while a write transaction is open, and two backups never overlap.
- A backup only runs when something changed since the last one. A failed backup leaves the changes marked as pending so the next run retries them, and a change made while a backup runs schedules the next one instead.
- Shutdown runs one last backup after the in-flight commands are drained and before the database is closed, bounded by `BACKUP_CONFIG.shutdownTimeoutMs`. A backup folder that stopped answering delays the quit by at most that timeout and then loses only that backup: the database is the source of truth and is already saved.

### Backup Folder Selection

`src/main/config/BackupLocationManager.ts` owns the backup folder and reports it as a `BackupLocation` with `directory`, `defaultDirectory`, `databaseDirectory`, `databasePath`, `isDevelopment`, and an optional `message`.

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

`src/main/storage/SpotDatabase.ts` opens or creates `spot.sqlite` using Electron's bundled Node `node:sqlite` support. No external SQLite dependency is used. The connection is switched to `journal_mode = WAL` right after it is opened, which is safe because the database file never leaves the local user-data disk. The raw SQLite connection stays private to `SpotDatabase.ts`; task storage uses wrapper methods for SQL execution, row reads, transactions, and the backup `VACUUM INTO`. `createTaskStorage({ databaseDirectory, backupDirectory })` owns one lazy database wrapper, opens it on the first status, load, write, or backup operation, reuses it across storage calls, and closes it from `prepareForShutdown()`.

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

Each task write command runs in exactly one SQLite transaction on the storage-owned connection. Bulk changes must not be split into per-task transactions. Transactions are opened with `BEGIN IMMEDIATE`, never a plain deferred `BEGIN`: the write lock is taken upfront so a concurrent writer on the same database file cannot make the transaction fail with an unrecoverable `SQLITE_BUSY` while it upgrades from a read to a write. The busy handler installed through `STORAGE_CONFIG.databaseTimeoutMs` can then retry the initial lock acquisition normally. Fields marked immutable in `TASK_FIELD_COLUMN_MAPPINGS`, currently `id`, cannot be included in update changes. If an update or delete references a missing task row, the command fails and the transaction rolls back. That failure is reported as `invalid-command`, not as `database-error`: the row will not appear later, so retrying the command would never succeed and would keep every task change made afterwards from ever being written, because the write queue never lets a later command overtake a failed one. Task durability is immediate and does not rely on delayed batching.

`readTasksFromDatabase()` in `src/main/storage/TaskRepository.ts` maps each row independently: a row that fails mapping (unrecognized `state`/`priority`, or malformed `tags_json`) is skipped and logged with `spotLogger.warn()` rather than failing the whole load, so one corrupt row cannot hide every other task behind a storage-unavailable state.

### Renderer Behavior

React calls `loadTasks()` through `window.spotStorage` once on startup and calls `executeTaskCommand()` for task mutations. The database never moves, so there is nothing that makes React reload it. It updates optimistically for normal task changes, keeps the latest renderer-facing `StorageStatus`, stays quiet while the database is healthy, shows startup storage failures before rendering task lists, shows a prominent save warning when writes fail, and shows a quieter notice when backups fail.

### Writing Task Changes

`src/logic/TaskStorageQueue.ts` owns every task write. Commands are queued and written one at a time and in order, so a write that fails cannot be overtaken by later ones.

- A write that fails with `database-error`, or whose call throws, stays at the front of the queue and is retried every `STORAGE_CONFIG.writeRetryDelayMs`. A database that failed once can work again, and the change is not lost in the meantime.
- A write refused as `invalid-command` would be refused again in exactly the same way, so it is dropped instead of retried.
- A failed write does not touch the task state. The state holds what the user wanted, and reading the database back over it would throw that away, so React keeps it and only warns. There is no reconciliation and no reload after a write failure.
- The warning lives as long as the change is unwritten: it is cleared when the queue drains, never by an unrelated command that happened to succeed. A dropped command keeps warning until tasks are loaded again, because that change will never be written.
- Successful writes are silent. There is no saving or saved indicator.

### Buffered Task Changes

Task edits are not sent to the task state on every keystroke. `src/logic/PendingTaskChanges.ts` holds them in a buffer keyed by task ID, outside the component tree, so that they cannot be lost when a task component re-renders, is filtered out, or unmounts.

- Task components read the buffer through `useSyncExternalStore` and render the task state merged with it. The rendered value is derived from both on every render, so the inputs and the task state can never drift apart.
- Only the components of the edited task re-render while the user types, because subscribers are registered per task ID.
- A buffered change is saved after `TASKS_CONFIG.flushDelayMs`, or after the shorter `TASKS_CONFIG.stateChangeDelayMs` when it is a pending state change. Every new change restarts the delay, and a value brought back to the one already in the task state is dropped from the buffer.
- `TasksPage` registers the single applier that saves buffered changes. It looks the task up by ID in the current task state, so changes are always applied to the task as it is at save time, and a task that no longer exists is skipped.
- `TasksPage` clears the buffer of a deleted task, and saves everything still buffered when it unmounts, before unregistering the applier.
- A save takes out of the buffer only what it is actually saving. Anything the user typed in the meantime and that is not part of that save stays buffered.
- The trailing tag input is buffered as `newTag` and is not a task change until it is committed. Delayed and explicit saves leave it alone, because the user may still be typing; only the final flush of the whole buffer turns it into a tag. Saving the other buffered changes of the same task must therefore not clear it either.
- Buffered changes are never dropped when no applier is registered: they stay buffered until one is.

`StorageStatus` reports the database state as `healthy` or `unavailable`, plus `storageDirectory`, `databasePath`, and a `backup` status. Database health is hard: `unavailable` means the tasks may not be saved and React says so prominently. Backup health is soft and separate: `idle`, `ok`, or `failed`, with the backup `directory`, the `lastBackupAt` and `lastBackupPath` of the last successful one, and a failure `message`. A failed backup never makes the database unhealthy, because the tasks are already saved in the local database either way.

`StorageStatus` also keeps the `not-configured` database state and the `not-implemented` failure reason, which the main process never produces. They are used only by the renderer, to describe a React build opened without the Electron preload API. The remaining storage failures are `database-error`, `invalid-command`, and `shutdown`.

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

Operational-log failures are not renderer-facing. Startup log file open failures are tracked internally by `SpotLogger`, and runtime log write failures are ignored after bounded retries when SQLite succeeds. Database folder failures must leave persistence visibly non-healthy rather than pretending data is saved.

Backup failures are renderer-facing but never alarming. They are logged, reported through the pushed backup status, and shown as a notice in the task page and in Settings, always stating that the tasks themselves are saved. A backup failure must never be routed through the database error path.

`src/main/ipc/TaskStorageIpc.ts` registers a `before-quit` drain. The first quit request waits for in-flight task write commands, runs the last backup under its bounded timeout, calls `prepareForShutdown()` so the SQLite connection closes, flushes the process-wide logger so pending log retries can settle or be abandoned according to the bounded retry policy, and then resumes quitting. New write commands after shutdown begins return a `shutdown` failure instead of being enqueued behind the quit drain.

React buffers task edits for a few seconds, so the quit drain would close the database while the user's last keystrokes are still in the renderer. The first quit request therefore starts with a renderer flush handshake:

1. The main process sends `spot-storage:flush-pending-task-changes` to the window and waits.
2. Task write commands keep being accepted during that wait, because refusing them is exactly what would lose the buffered edits.
3. React saves every buffered task change, waits for the resulting storage commands, and invokes `spot-storage:pending-task-changes-flushed`.
4. Only then does the main process refuse further commands, drain the in-flight ones, close the database, and flush the logger.

The wait is bounded by `SHUTDOWN_CONFIG.rendererFlushTimeoutMs`, so an unresponsive or already destroyed renderer delays the quit by at most that timeout. When no renderer is wired at all, shutdown starts immediately and later commands are refused right away.

Closing the window runs the same handshake, through `requestRendererFlushBeforeWindowClose()`, which `Main.ts` calls from the window `close` event. Closing is the usual way of leaving the application and it destroys the renderer, on Windows and Linux before `before-quit` ever runs and on macOS without quitting at all, so the handshake cannot be left to the quit path alone. The two differ in what follows: a window close only saves the buffered edits and then destroys the window, while a quit also refuses later commands, drains, backs up, and closes the database. The window close therefore keeps accepting task commands afterwards, because the application may still be running. When a window closes as part of a quit, `requestRendererFlushBeforeWindowClose()` returns nothing and the window closes right away, and a window closing while a quit starts, or the other way around, joins the handshake already running instead of asking the renderer twice.

`installPendingTaskChangesFlushHandler()`, installed once when the renderer starts, answers that request and also saves the whole buffer on the window `pagehide` event. The page hide save is only a last resort: the renderer is being torn down at that point, so the storage commands it queues cannot all be delivered, which is exactly why the close interception exists.

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

`SettingsPage` renders `BackupSettings` from `src/components/storage`. The section is written to make the persistence model obvious to the user, because the two folders it names mean very different things:

- The task database section states that the tasks live in a single `spot.sqlite` file inside the SPOT application folder, that this is always where they are read from and written to, and that it cannot be moved. It shows the full database path.
- The backup folder section states how often copies are written, how many are kept, and that a synchronized folder is safe to use but that SPOT never reads these copies back, does not keep two computers in sync, and leaves restoring to the user.

It also shows the current backup folder, a development-run notice when the run is not packaged, the reason a saved folder could not be used, the outcome of the last backup, and two actions:

- Change folder, which opens the native folder dialog.
- Use default folder, which selects the default folder of the current run.

Both actions open a `ConfirmModal` that names the current folder, the new folder, and states that the copies already written stay where they are and that the tasks are not moved. The change is applied only after confirmation, and its outcome is reported in place.

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

Completed tasks are sorted by `completionDate` descending, then by ID. A completed task stored without a completion date simply sorts last: the comparator must not assume the date is there, because throwing while the loaded tasks are sorted would fail the whole startup load and hide every other task behind a storage error.

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
- task shallow cloning, task loading, loading a completed task that has no completion date, importance sorting, state changes, and new-task defaults
- filter cloning and task visibility matching
- domain counting, active/filter domain separation, and selected-filter cleanup
- date comparison and display formatting
- smoke coverage for task filters and task list interactions
- SQLite storage setup, task row mapping, command execution, transaction rollback, and optional operational logging behavior
- storage IPC handler registration, channel delegation, shutdown drain, post-shutdown command failure behavior, exclusive access that finalizes in-flight commands and queues later ones, and two overlapping exclusive operations running one after the other with no command in between
- the shutdown flush handshake: buffered renderer changes saved before the database is closed, commands refused only after the renderer reported, and a bounded wait when the renderer never reports
- the window close flush handshake: buffered renderer changes saved while the database stays open, no wait when the window closes as part of a quit or its renderer is already gone, one single handshake shared by a window close and a quit, and a new handshake for a window closed later
- the buffered task changes: save delays and their restart, immediate saves, forgetting a reverted value, the shorter state change delay, updater-form changes, dropping the buffer of a deleted task, committing the trailing tag input only on the final save, keeping the trailing tag input buffered while the other changes of the same task are saved, keeping changes when no applier is registered, per-task subscriber notification with stable snapshots, page hide saving, waiting for in-flight storage commands, and reporting to the main process only once storage caught up
- runtime path resolution for packaged and development runs
- backup folder resolution at startup, saved-folder reuse, the development folder override, the fallback to the default folder when the saved or chosen one cannot be used, configuration persistence, and running the change on the storage chain
- backup location IPC registration, cancelled folder dialogs, and rejecting a chosen path that is not a usable folder
- backup file naming and chronological sorting, a written copy that reopens as a valid SPOT database, backup folder creation, pruning down to the retained count while leaving other files alone, clearing a partial copy left by an interrupted backup, and failing without leaving a temporary file behind
- backup scheduling: waiting for the task changes to settle and restarting that wait, skipping a backup when nothing changed, retrying after a failure, reporting every outcome, running on the storage chain, backing up once more at shutdown while cancelling the pending schedule, and giving up on a shutdown backup that takes too long
- a backup copy holding the stored tasks, and a failed backup that leaves the database healthy
- smoke coverage for the Settings panel showing the fixed database location, reporting a failed backup without claiming the tasks are lost, and the confirmed backup folder change
- Electron window load-target resolution for local built React loading
- React task-page startup loading, Electron preload API requirement, persisted Electron loading, and startup-error rendering
- React task-page storage commands for create, update, delete, complete, restore, manual reorder, and importance sort, plus the write-failure warning, storage-health feedback, and the task state being kept as it is after a rejected write
- the task write queue: in-order writing, retrying a failed or thrown write while keeping the warning until it goes through, later commands not overtaking a failed one, dropping a refused command instead of retrying it forever, keeping a dropped command's warning through later successful writes, and database status reporting
- task edit durability corner cases: edits still saved after the task is filtered out of the list, never saved for a deleted task, task state values shown again when the parent replaces the task, what the user is typing kept while the parent replaces the task, the trailing tag input saved when the task disappears, a half-typed tag left in its input while another edit of the same task is saved, and everything saved before the renderer goes away
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
