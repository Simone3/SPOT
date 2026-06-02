# SPOT Documentation

SPOT is the Simple Planner & Organizer Tool: a small Electron + React task manager intended to run on macOS, Windows, and Linux. The project is still in progress. The React web application is the current working surface, and the next major focus is wiring the Electron shell to persistent task storage.

## Current Status

- The React app is the primary working surface and is considered done for now.
- Task data is currently loaded from in-memory sample data in `src/logic/TaskStateLogic.ts`.
- Task changes are held in React state only. They are not persisted to disk or a database.
- The Electron main process opens `http://localhost:3000`, so the React dev server must be running when using the Electron shell.
- The Notes, Tags, and Settings routes exist as placeholder pages.
- The planned persistence architecture is one SQLite database as the source of truth plus one append-only `spot-logs.ndjson` operational log.

## How To Run

Install dependencies:

```sh
npm install
```

Run the React app:

```sh
npm run start-react
```

Run the Electron shell:

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
npm run build-react
npm run package
npm run make
```

## Repository Map

- `AGENTS.md` contains contributor and automation instructions. Keep it aligned with this document.
- `README.md` intentionally stays minimal.
- `DOCUMENTATION.md` is this detailed project reference.
- `eslint.config.js` contains the flat ESLint configuration used by `npm run lint`.
- `main.js`, `preload.js`, and `renderer.js` are the Electron layer.
- `index.html` and `public/index.html` are HTML entry points.
- `src/index.tsx` mounts the React app and defines routes.
- `src/index.css` defines global layout and theme variables.
- `src/types` contains shared TypeScript types split into semantic files for tasks, domains, filters, and dates. Types that have one clear owner stay in the owning `.ts` or `.tsx` file instead.
- `src/react-app-env.d.ts` contains the React Scripts TypeScript reference.
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
- `BrowserRouter`
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

`main.js` creates a `BrowserWindow` and loads `http://localhost:3000`. It also registers a sample `ping` IPC handler.

`preload.js` exposes a `window.versions` API with Node, Chrome, Electron, and `ping` helpers.

`renderer.js` is still the default Electron starter-style renderer script and is not part of the React task UI.

Known Electron work still pending:

- Load the built React app in packaged mode.
- Replace in-memory sample data with persistent storage.
- Implement the planned SQLite database and `spot-logs.ndjson` operational log.
- Add robust save, reload, error handling, and shutdown behavior.

## Persistence Plan

The planned persistence architecture uses a single SQLite database as the source of truth and an append-only `spot-logs.ndjson` file as an operational log. SQLite owns normal application reads and writes. The log records what the React app asked the main process to do and what SQL the main process ran in response. It is useful for debugging, support, and manual inspection, but it is not part of the normal startup read path.

Reasoning:

- A single SQLite database keeps task loading and mutations simple.
- Google Drive or similar filesystem sync should be treated as backup or cross-device handoff, not live collaborative database replication.
- The log should be append-only so each meaningful main-process action leaves an external trace.
- The log is best-effort. If writing a log line fails, the app should retry for a bounded time and then continue running. A logging failure must not make a successful database write invalid.
- React should update optimistically for normal task changes. The main process reports the extreme case where a database write fails, and the UI must warn the user and reconcile state.

Storage files:

- `spot.sqlite`: the canonical task database.
- `spot-logs.ndjson`: append-only operational log with one JSON object per line.

Initial storage location:

- Use Electron's app data location through the main process, with files kept in an app-owned subdirectory.
- A later settings feature can allow the user to choose a Google Drive, OneDrive, Dropbox, or other synced folder.

Core invariants:

- React keeps an in-memory task copy for responsiveness, but persistence owns task durability.
- Every task mutation goes through the Electron main process.
- The renderer never gets broad filesystem or SQLite access.
- Each user command maps to exactly one SQLite transaction.
- Bulk operations, such as sorting active tasks by importance, are one command and one transaction.
- Normal startup reads tasks from SQLite, not from `spot-logs.ndjson`.
- The main process logs every incoming React storage command.
- The main process logs every SQL query it runs, including `SELECT` queries, with duration and success or failure.
- If the SQLite transaction fails after React has already updated optimistically, the UI must show a clear storage failure and reconcile the affected task state.
- If logging fails but SQLite succeeds, the task change remains valid.

Failure model:

- Database write failure: report the failure to React, show a user-facing storage error, and reconcile any optimistic local state.
- Operational-log write failure: retry for a bounded time, keep the app usable if retries fail, and expose logging health through storage status.
- Startup operational-log write failure: load tasks from SQLite, but show a warning that operational logging is unavailable if the failure persists.
- Storage folder unavailable: fail startup or enter a clear read-only/error state, depending on the final UI decision.

Operational log format:

```json
{"createdAt":"2026-06-02T12:00:00.000Z","type":"react.command","command":"task.update","payload":{"taskId":"...","change":{"text":"New"}}}
{"createdAt":"2026-06-02T12:00:00.003Z","type":"sql.query","query":"UPDATE tasks SET text = ? WHERE id = ?","durationMs":2.4,"result":"success"}
```

React command names:

- `task.create`
- `task.update`
- `task.delete`
- `tasks.reorder`
- `tasks.import`

Completing and restoring tasks are represented as `task.update` commands because they update `state` and `completionDate`.

SQL log entries:

- Log all `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries run by the storage layer.
- Include the query text, duration in milliseconds, and success or failure.
- Do not log sensitive values beyond the task data the user already stores in SPOT.
- Log query parameters only when they are useful for debugging and safe to write to disk.

### Persistence Implementation Steps

Each step below is intended to be self-contained, committed separately, and manually reviewable before the next step starts.

1. Document and freeze the persistence contract.

   Scope:

   - Keep this persistence plan current.
   - Define the high-level command names and expected failure behavior.
   - Do not change runtime behavior yet.

   Validation:

   - Read `DOCUMENTATION.md` and `AGENTS.md` for consistency.
   - No code validation is required unless source files change.

   Commit boundary:

   - Documentation-only commit.

2. Add main-process storage module skeleton.

   Scope:

   - Add an Electron main-process storage module with placeholder methods for loading tasks, mutating tasks, writing operational log lines, and reporting storage status.
   - Keep methods unimplemented or backed by temporary no-op behavior that is not wired to React yet.
   - Define local command/result types in the owning files where practical.
   - Do not add new dependencies in this step.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Commit boundary:

   - New module structure compiles and tests still pass, but app behavior is unchanged.

3. Add SQLite open, schema migration, and task row mapping.

   Scope:

   - Open or create `spot.sqlite` from the main process.
   - Create migration support from version `1`.
   - Create `tasks` and `schema_migrations` tables.
   - Add mapping between SQLite rows and `Task`.
   - Add focused tests for serialization of tags, dates, booleans, and completion dates.

   Schema:

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

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Commit boundary:

   - The database can be initialized and task rows can be mapped, but React still uses sample data.

4. Implement task load and read-only storage status.

   Scope:

   - Implement `loadTasks()` against SQLite.
   - Return tasks plus storage status.
   - Do not wire React startup yet.
   - Add tests for empty database loading and stored task loading.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Commit boundary:

   - Main-process storage can read persisted tasks, but app behavior is still unchanged.

5. Implement write commands and SQLite transactions.

   Scope:

   - Implement task create, update, delete, and reorder commands.
   - Represent complete and restore as task update commands.
   - Each command runs in one SQLite transaction.
   - Add tests for successful writes, multi-task reorder, and rollback on failure.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Commit boundary:

   - Storage commands mutate SQLite correctly, but no operational log file is written yet and React is still unwired.

6. Implement `spot-logs.ndjson` operational logging.

   Scope:

   - Append every incoming React storage command to `spot-logs.ndjson`.
   - Append every storage-layer SQL query to `spot-logs.ndjson`, including `SELECT` queries.
   - Include query duration, success or failure, and safe diagnostic details.
   - Retry failed log writes for a bounded time.
   - Keep operational-log failure separate from database write failure.
   - Add tests for successful logging, failed logging, retry behavior, and continued app operation after repeated logging failures.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Commit boundary:

   - SQLite remains canonical and operational logging is best-effort, but React is still unwired.

7. Add preload and IPC API.

   Scope:

   - Register main-process IPC handlers for storage commands.
   - Expose a narrow `window.spotStorage` API through `preload.js`.
   - Add renderer-side TypeScript declarations for the exposed API.
   - Do not expose raw `ipcRenderer`, filesystem, or SQLite objects.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Commit boundary:

   - React can call the storage API, but existing React data flow is not migrated yet.

8. Wire React startup loading.

   Scope:

   - Replace sample task initialization with `window.spotStorage.loadTasks()` when running under Electron.
   - Keep a development fallback for the browser-only React dev server if needed.
   - Represent loading, loaded, and startup-error states in the task page.
   - Do not migrate all mutations yet.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - Manual smoke check in React-only mode.
   - Manual smoke check in Electron mode.

   Commit boundary:

   - Startup reads persisted data, while mutations may still use the existing in-memory flow until later steps.

9. Wire React task mutations one group at a time.

   Scope:

   - Migrate add, edit, delete, complete, restore, manual reorder, and importance sort to storage commands.
   - Update React state optimistically for normal task changes instead of waiting for a database acknowledgment.
   - Keep existing task/domain/filter logic as the local state update mechanism.
   - Reconcile optimistic local state and show a warning if the main process reports a database write failure.
   - Add or adjust smoke tests for critical task flows.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - Manual smoke check in Electron mode.

   Commit boundary:

   - All task mutations are sent to storage while React remains responsive and handles failed persistence explicitly.

10. Add user-facing storage health feedback.

   Scope:

   - Show database write failures as prominent task-save errors.
   - Show operational-log failures as non-blocking warnings.
   - Expose enough storage status for the UI to tell the difference.
   - Avoid noisy UI when storage is healthy.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - Manual smoke check for simulated database and operational-log failures.

   Commit boundary:

   - Users can tell whether tasks are saved and whether the operational log is healthy.

11. Add shutdown and pending-write handling.

   Scope:

   - Ensure in-flight commands settle or fail clearly before app shutdown.
   - Flush or abandon pending operational log retries according to the bounded retry policy.
   - Do not rely on delayed batching for task durability.
   - If future batching is introduced, this step must be revisited before batching ships.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - Manual quit/reopen smoke check.

   Commit boundary:

   - Quitting and reopening the app preserves all committed task mutations.

12. Update packaging and production loading.

   Scope:

   - Load the built React app in packaged mode.
   - Keep development loading from `http://localhost:3000` convenient.
   - Verify storage paths work in development and packaged layouts.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build-react`
   - Package or make smoke check when practical.

   Commit boundary:

   - Electron can run the persisted task app outside the React dev server.

13. Final persistence documentation pass.

   Scope:

   - Update this document with the implemented storage paths, schema, IPC API, failure behavior, and test coverage.
   - Update `AGENTS.md` only if contributor instructions changed.
   - Keep `README.md` and `TODO.md` untouched.

   Validation:

   - `npm run lint`
   - `npm run typecheck`
   - `npm test`

   Commit boundary:

   - Documentation matches the implemented persistence layer.

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

Validation commands:

```sh
npm run lint
npm run typecheck
npm test
```

Future testing priorities:

- broader interaction coverage as task editing and drag-and-drop behavior are polished
- integration coverage for the planned SQLite and `spot-logs.ndjson` persistence layer once it exists

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

- Implement the planned SQLite database and `spot-logs.ndjson` operational log.
- Add persistence and Electron-shell integration tests once storage exists.
- Improve accessibility and focus behavior in reusable inputs and clickables.
- Continue polishing drag-and-drop feedback as the task interaction model settles.
- Make `DatesContextProvider` refresh date labels after midnight.
- Replace sample data loading with real data loading.
- Add error handling and user-facing save/reload feedback.
- Finish Notes, Tags, and Settings pages when their scope is clear.
