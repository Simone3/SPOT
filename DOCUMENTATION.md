# SPOT Documentation

SPOT is the Simple Planner & Organizer Tool: a small Electron + React task manager intended to run on macOS, Windows, and Linux. The project is still in progress. The React renderer is considered done for now, and the initial Electron persistence layer is wired for startup loading, task mutations, shutdown draining, and packaged loading. Standalone browser mode is no longer a supported runtime.

## Current Status

- The React renderer is the primary working surface and is considered done for now.
- Task data loads through `window.spotStorage.loadTasks()` in Electron. If the renderer is opened without the Electron preload API, the task page reports storage as unavailable.
- Task changes are applied optimistically in React state. Add, edit, delete, complete, restore, manual reorder, and importance sort send storage commands through `window.spotStorage.executeTaskCommand()`.
- Main-process storage modules exist under `src/main/storage`. Configured storage initializes SQLite at the Electron user-data storage path, owns one lazy database connection per storage instance, loads task rows, executes task write commands, writes through the process-wide operational logger, reports database health, and closes the database during shutdown. Electron exposes that boundary through storage IPC and `window.spotStorage`; React uses it for startup loading, task mutations, and non-healthy database status feedback.
- Electron main and preload TypeScript sources are bundled by `scripts/build-electron.js` into ignored `dist/electron` files before Electron starts or packages. The bundling step uses exact-version `esbuild` to remove the former custom runtime TypeScript/module resolver.
- Electron loads the built React `build/index.html` file in both development and packaged mode. `package.json` sets CRA's `homepage` to `.` so production asset URLs stay relative under file loading.
- The Notes, Tags, and Settings routes exist as placeholder pages.
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

- `AGENTS.md` contains contributor and automation instructions. Keep it aligned with this document.
- `README.md` intentionally stays minimal.
- `DOCUMENTATION.md` is this detailed project reference.
- `eslint.config.js` contains the flat ESLint configuration used by `npm run lint`.
- `scripts/build-electron.js` bundles Electron main and preload TypeScript sources into ignored `dist/electron` runtime files.
- `public/index.html` is the React renderer HTML template.
- `src/index.tsx` mounts the React app and defines routes.
- `src/index.css` defines global layout and theme variables.
- `src/main/Main.ts` initializes the process-wide logger, creates the Electron `BrowserWindow`, loads the built React renderer, and registers IPC handlers.
- `src/main/preload/Preload.ts` exposes the narrow renderer APIs through Electron's context bridge.
- `src/main/logging/SpotLogger.ts` configures `electron-log` behind a generic factory-created logger and exports the process-wide `spotLogger` utility with `info`, `warn`, `error`, `debug`, and `flush` methods, newline-delimited JSON output, size-based rolling, and one retained archive.
- `src/main/ipc/TaskStorageIpc.ts` registers the narrow Electron IPC surface for storage loading, task write commands, database health reporting, and shutdown draining for in-flight task commands.
- `src/main/storage/TaskStorage.ts` defines the Electron main-process storage contract, configured SQLite task loading and write commands through a storage-owned database connection, database health reporting, and shutdown preparation.
- `src/main/storage/TaskCommandExecutor.ts` maps task storage commands to the task repository operations and keeps each command inside one transaction.
- `src/main/storage/SpotDatabase.ts` opens `spot.sqlite`, applies schema migrations, currently creates schema version `1`, exposes a small internal query wrapper, and emits SQL query log records through the process-wide logger.
- `src/main/storage/TaskRowMapping.ts` maps between SQLite task rows and React `Task` objects and owns the shared task field to SQLite column mapping used by storage queries.
- `src/main/storage/TaskRepository.ts` owns SQLite task queries and task repository helpers that can run against an existing SPOT database wrapper or a short scoped repository session.
- `src/main/window/WindowLoadTarget.ts` resolves the built React `build/index.html` file from the Electron app root.
- `src/types` contains shared TypeScript types and constants split into semantic files for tasks, task storage, task-storage IPC channels, domains, filters, and dates. Types that have one clear owner stay in the owning `.ts` or `.tsx` file instead.
- `src/react-app-env.d.ts` contains the React Scripts TypeScript reference plus renderer-side declarations for `window.versions` and `window.spotStorage`.
- `src/components/common` contains layout and shared UI primitives.
- `src/components/inputs` contains reusable inputs.
- `src/components/tasks` contains the current task-management UI.
- `src/components/notes`, `src/components/tags`, and `src/components/settings` contain placeholder route pages.
- `src/contexts` contains app-level React contexts.
- `src/logic` contains state and domain logic.
- `src/utils` contains general utilities.
- `tests` contains Jest tests, test setup, and test-only helpers.

## Source Imports

React source files use absolute imports rooted at `src/...`, including local CSS imports, instead of relative `./` or `../` paths. `tsconfig.json` sets `baseUrl` to the repository root so TypeScript, React Scripts, Jest, and ESLint can resolve those imports consistently.

## Application Shell

`src/index.tsx` renders:

- `DatesContextProvider`
- `HashRouter`
- `Sidebar`
- `MainContent`
- routes for Tasks, Notes, Tags, and Settings

Routes:

- `/` renders `TasksPage`
- `/notes` renders `NotesPage`
- `/tags` renders `TagsPage`
- `/settings` renders `SettingsPage`

The page layout is a fixed-height flex app:

- `#root` is a horizontal flex container.
- `Sidebar` stays on the side.
- `MainContent` renders the selected route.
- `Page` and `Pane` build the page-level split layout.

## Electron Layer

`package.json` points Electron at `dist/electron/main.js`, which is generated from `src/main/Main.ts` by `npm run build-electron`. The build script bundles `src/main/Main.ts` and `src/main/preload/Preload.ts` with `esbuild`, preserving external Electron and `electron-log` imports while resolving in-repository `src/...` imports at build time.

`src/main/Main.ts` initializes `spotLogger` as soon as Electron is ready and the user-data path is available, then creates a `BrowserWindow`. It uses `resolveWindowLoadTarget()` from `src/main/window/WindowLoadTarget.ts` to load the built React `build/index.html` file through `loadFile()` in both development and packaged mode. It registers a sample `ping` IPC handler and the storage IPC handlers from `src/main/ipc/TaskStorageIpc.ts`, which also attach the storage shutdown drain to Electron's `before-quit` event.

`src/main/preload/Preload.ts` exposes a `window.versions` API with Node, Chrome, Electron, and `ping` helpers. It also exposes the narrow `window.spotStorage` API documented in the Persistence section. It does not expose raw `ipcRenderer`, filesystem, or SQLite objects. Shared storage IPC channel names live in `src/types/TaskStorageIpcChannels.ts` so preload and main-process handlers cannot drift.

Known Electron work still pending:

- Add robust save, reload, and error handling polish.

## Persistence

SPOT persists tasks only in Electron runtime. The Electron main process owns durable storage, operational logging, and database health, while React owns the responsive in-memory task state used by the UI. The renderer requires `window.spotStorage` on startup; opening the React build outside Electron reports storage as unavailable.

SQLite is the source of truth for task reads and writes. The append-only operational log is a diagnostic trace of storage commands and SQL activity; startup never rebuilds task state from the log. Google Drive or similar filesystem sync should be treated as backup or cross-device handoff, not live collaborative database replication.

### Storage Files

In Electron runtime, `src/main/ipc/TaskStorageIpc.ts` resolves the storage directory to:

```ts
path.join(app.getPath('userData'), 'storage')
```

That directory contains:

- `spot.sqlite`: the canonical task database.
- `spot-logs.ndjson`: newline-delimited operational log entries.
- `spot-logs.old.ndjson`: the single retained rolled log archive.

Without a configured storage directory, `createTaskStorage()` reports the database as `not-configured`. A later settings feature can allow the user to choose a Google Drive, OneDrive, Dropbox, or other synced folder.

### SQLite Schema

`src/main/storage/SpotDatabase.ts` opens or creates `spot.sqlite` using Electron's bundled Node `node:sqlite` support. No external SQLite dependency is used. The raw SQLite connection stays private to `SpotDatabase.ts`; task storage uses wrapper methods for SQL execution, row reads, and transactions. `createTaskStorage({ storageDirectory })` owns one lazy database wrapper, opens it on the first status, load, or write operation, reuses it across storage calls, and closes it from `prepareForShutdown()`.

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

Supported write commands are:

- `task.create`
- `task.update`
- `task.delete`
- `tasks.updateMany`

Completing and restoring tasks are represented as `task.update` commands because they update `state` and `completionDate`. Manual reorder and sort by importance use `tasks.updateMany` with a `reason`, such as `manual-reorder` or `importance-sort`.

Each configured task write command runs in exactly one SQLite transaction on the storage-owned connection. Bulk changes must not be split into per-task transactions. Fields marked immutable in `TASK_FIELD_COLUMN_MAPPINGS`, currently `id`, cannot be included in update changes. If an update or delete references a missing task row, the command fails and the transaction rolls back. Task durability is immediate and does not rely on delayed batching.

### Renderer Behavior

React calls `loadTasks()` through `window.spotStorage` on startup and calls `executeTaskCommand()` for task mutations. It updates optimistically for normal task changes, keeps the latest renderer-facing `StorageStatus`, stays quiet while the database is healthy, shows startup storage failures before rendering task lists, and shows a prominent save warning when writes fail.

`StorageStatus` reports the database state as `not-configured`, `healthy`, or `unavailable`, plus the configured `storageDirectory` and `databasePath` when available. Storage failures use `not-implemented`, `database-error`, `invalid-command`, or `shutdown`.

### Operational Logging

`src/main/logging/SpotLogger.ts` uses `electron-log` version `5.4.4` to write newline-delimited JSON entries to `spot-logs.ndjson`. The dependency is wrapped by `createSpotLogger()`, while `initializeSpotLogger()` installs the concrete logger behind the process-wide `spotLogger` utility. Main-process code can call `spotLogger.info`, `spotLogger.warn`, `spotLogger.error`, `spotLogger.debug`, and `spotLogger.flush` without depending on `electron-log` directly or constructing a logger itself.

The main process logs every incoming React storage command and every SQL query run by the storage layer, including `SELECT` queries. SQL log entries include the query text, `elapsedMillis`, and success or failure. Query parameters should be logged only when they are useful for debugging and safe to write to disk.

Example entries:

```json
{"createdAt":"2026-06-02T12:00:00.000Z","level":"info","message":"React storage command received","type":"react.command","command":"task.update","payload":{"taskId":"...","change":{"text":"New"}}}
{"createdAt":"2026-06-02T12:00:00.001Z","level":"info","message":"React storage command received","type":"react.command","command":"tasks.updateMany","payload":{"reason":"manual-reorder","updates":[{"taskId":"...","change":{"sortPosition":1000}},{"taskId":"...","change":{"sortPosition":2000}}]}}
{"createdAt":"2026-06-02T12:00:00.003Z","level":"info","message":"Storage SQL query completed","type":"sql.query","query":"UPDATE tasks SET text = ? WHERE id = ?","elapsedMillis":2.4,"result":"success"}
```

Logger write methods return `void`; normal callers do not await operational logging or inspect write outcomes. The file transport writes only JSON lines, uses a 1 MiB maximum file size, and keeps one rolled archive so logs cannot grow without limit. Runtime log write failures are retried for a bounded time and then ignored when SQLite succeeds. `flush()` is reserved for shutdown preparation and waits for already pending write attempts to finish their bounded retries.

### Failure And Shutdown

Database write failures are user-facing. The SQLite transaction must not partially commit, the main process reports the failure to React, and React reconciles optimistic local state. Database read or startup failures are also user-facing; React receives a storage error state instead of silently falling back to stale persisted data.

Operational-log failures are not renderer-facing. Startup log file open failures are tracked internally by `SpotLogger`, and runtime log write failures are ignored after bounded retries when SQLite succeeds. Storage folder failures must leave persistence visibly non-healthy rather than pretending data is saved.

`src/main/ipc/TaskStorageIpc.ts` registers a `before-quit` drain. The first quit request waits for in-flight task write commands, calls `prepareForShutdown()` so the SQLite connection closes, flushes the process-wide logger so pending log retries can settle or be abandoned according to the bounded retry policy, and then resumes quitting. New write commands after shutdown begins return a `shutdown` failure instead of being enqueued behind the quit drain.

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

- keeps an internal copy of its task while the user edits
- buffers changed fields in a ref
- flushes content and metadata changes after 5 seconds, on blur, or on unmount
- fades out for 3 seconds before flushing a state change from the completion checkbox; while fading, other task controls are disabled, and changing the checkbox back before the fade completes cancels the state flush and restores full opacity
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

## Filtering

`src/logic/FiltersLogic.ts` controls task visibility.

Current filters:

- Text search against `task.text`, using a case-insensitive regular expression.
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
- `YYYY-MM-DD` conversion for stored due dates

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
- storage IPC handler registration, channel delegation, default Electron storage directory resolution, shutdown drain, and post-shutdown command failure behavior
- Electron window load-target resolution for local built React loading
- React task-page startup loading, Electron preload API requirement, persisted Electron loading, and startup-error rendering
- React task-page storage commands for create, update, delete, complete, restore, manual reorder, and importance sort, plus write-failure warning, storage-health feedback, and reconciliation behavior
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

- Keep `README.md` minimal.
- Keep this document detailed and current.
- Keep `AGENTS.md` and this document aligned.
- Use plain React with TypeScript and CSS.
- Do not add frameworks such as Vite or Next.js.
- Do not add dependencies unless they clearly reduce work or risk.
- Keep dependency versions exact in `package.json`.
- Prefer existing component and logic patterns.
- Define types in their owning file whenever practical. Shared cross-owner types live in semantic files under `src/types`.
- Keep tests minimal but meaningful.
- Run `npm run lint`, `npm run typecheck`, and `npm test` before closing a feature or fix.

## Near-Term Work

The most important remaining work is:

- Add persistence and Electron-shell integration tests for runtime startup, mutation, shutdown, and packaged loading flows.
- Improve accessibility and focus behavior in reusable inputs and clickables.
- Continue polishing drag-and-drop feedback as the task interaction model settles.
- Make `DatesContextProvider` refresh date labels after midnight.
- Continue polishing reload feedback.
- Finish Notes, Tags, and Settings pages when their scope is clear.
