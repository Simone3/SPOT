# SPOT Documentation

SPOT is the Simple Planner & Organizer Tool: a small Electron + React task manager intended to run on macOS, Windows, and Linux. The project is still in progress. The current development focus is the React web application; Electron exists as a shell but persistence and database integration are not wired yet.

## Current Status

- The React app is the primary working surface.
- Task data is currently loaded from in-memory sample data in `src/logic/TaskStateLogic.ts`.
- Task changes are held in React state only. They are not persisted to disk or a database.
- The Electron main process opens `http://localhost:3000`, so the React dev server must be running when using the Electron shell.
- The Notes, Tags, and Settings routes exist as placeholder pages.

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
- `src/__tests__` contains Jest tests.

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
- Decide on file or database storage.
- Add robust save, reload, error handling, and shutdown behavior.

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
- `visible` is derived from filters. It is required and sample/new tasks start as `false`.
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

The state helpers clone top-level containers and lists before updating them, while task objects are cloned only when a task is replaced or filter visibility changes.

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
- flushes changes after 5 seconds, on blur, when state changes, or on unmount
- owns the generic task value setter and passes field-specific setters to task chips
- renders priority, text, owner, due date, tags, completion checkbox, delete action, and drag handle text

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
3. Due date descending when both tasks have a due date.
4. Existing manual `sortPosition` as fallback.

Current caveat: due dates are stored as `YYYY-MM-DD` strings, while the comparator subtracts due date values directly. Review this when polishing sort behavior.

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
- text colors
- accent colors
- priority colors
- danger, warning, and disabled colors
- the Inter font family

The current visual direction is dark, direct, and utilitarian.

## Testing

Current test coverage is focused on `ManuallySortedList`:

- insertion at start, middle, and end
- position recomputation
- move operations
- random operation checks
- large random insert and move scenarios

Validation commands:

```sh
npm run lint
npm run typecheck
npm test
```

Future testing priorities:

- focused unit tests for task, domain, filter, and date logic
- smoke tests for adding, editing, completing, deleting, filtering, and sorting tasks
- integration coverage for persistence once the Electron/storage layer exists

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

- Add broader tests around task, domain, and filter logic.
- Improve accessibility and focus behavior in reusable inputs and clickables.
- Remove or hide debug drag-handle text in tasks when the drag UI is polished.
- Make `DatesContextProvider` refresh date labels after midnight.
- Decide and implement persistence in the Electron layer.
- Replace sample data loading with real data loading.
- Add error handling and user-facing save/reload feedback.
- Finish Notes, Tags, and Settings pages when their scope is clear.
