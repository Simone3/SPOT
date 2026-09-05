# §9 — Tasks

*[Index](README.md) · [← §8 Text and languages](08-text-and-languages.md)*

The task itself, the state around it, and the pure logic over it. How a task reaches SQLite is [§7](07-task-write-path.md); what the user sees is [§11](11-interface.md).

---

## 9.1 The task

The task shape is a TypeScript interface in `src/types/TaskTypes.ts`:

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

| Field | Notes |
| --- | --- |
| `id` | A UUID string |
| `text` | Free-form task content, as plain text: the blank lines and the line breaks it holds are the ones the user typed ([§11.4](11-interface.md#114-common-components)) |
| `state` | `ACTIVE` or `COMPLETED` |
| `priority` | `URGENT`, `HIGH`, `NORMAL` or `LOW` |
| `owner` | A free-form string. A missing or empty owner is displayed as `Me` |
| `dueDate` | A `YYYY-MM-DD` string. A missing or empty due date is displayed as no due date |
| `tags` | An array of free-form strings |
| `sortPosition` | The manual ordering of active tasks. Required, and new tasks start at `0` |
| `visible` | Derived from the filters at runtime. Required in the React task state, where sample and new tasks start as `false`, but **not stored in SQLite** |
| `completionDate` | Set when a task is completed |

**`tags` may hold empty strings in the React task state**, which are tag inputs the user is typing into or has just emptied rather than tags. `taskToPersistedTask()` in `src/logic/TaskComparison.ts` strips them on the way to storage, on both sides of the change comparison, so an empty tag never reaches SQLite and never looks like a change of its own.

[§6.3](06-persistence.md#63-the-sqlite-schema) has the columns each field lands in.

## 9.2 The task state

`src/logic/TaskStateLogic.ts` coordinates task state updates. The state container has three sections:

```ts
{
	tasksContainer,
	domainsContainer,
	filters
}
```

- `tasksContainer` has `active` and `completed`.
- `domainsContainer` has `filters`, the domains relevant to active task filters, and `form`, the domains available while editing tasks across active and completed tasks.
- `filters` has `text`, `owners`, `dueDates`, `priorities`, `tags` and `showCompleted`.

The state helpers clone top-level containers and lists before updating them. **Task objects remain shared until one of their fields changes**; edit, visibility and sort helpers clone each changed task object, including mutable task fields, before writing to it.

`src/contexts/TasksContext.tsx` holds that state for the whole renderer and exposes it, the startup state, the storage status and warning, and every task action. **It lives above the router on purpose:**

- **Tasks are loaded exactly once, when the application starts.** Moving between pages never reloads the database, and never resets filters, domains or the manual sort order.
- The startup load runs before any command can be queued, so it needs no ordering against the storage queue. **A reload added later, while the user is working, would need it**: it must await a bounded `waitForTaskStorageQueue()` first, so the database is not read before the queued writes are applied over it, and it must clear the storage warnings only once the reload has actually succeeded.
- Task actions read the current state through a ref, so they stay stable across renders and the applier registration never has to be torn down.

## 9.3 Filtering

`src/logic/FiltersLogic.ts` controls task visibility. The filters are a text search against `task.text`, using a case-insensitive plain substring match and no regex, plus priority, owner, due date and tag filters and the show-completed toggle.

- Completed tasks are hidden unless `showCompleted` is true.
- Priority, owner and due date filters match exact values.
- Tag filtering matches if a task has at least one selected tag.
- Active tasks are refreshed whenever filters change.
- Completed tasks are refreshed only when `showCompleted` is active or when that toggle changes.

## 9.4 Domains

`src/logic/DomainsLogic.ts` builds the option domains for filters and form inputs. A domain entry contains:

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

**Persistent domains**, whose labels are translated while their values are not: the priorities Urgent, High, Normal and Low, stored as `URGENT`, `HIGH`, `NORMAL` and `LOW`; the owner `Me`, represented by an empty string; and the due date `None`, also an empty string. `getInitialDomains()` takes those six labels as a `DomainLabels` argument rather than reading them itself, so the domain logic stays pure and free of translation; `TasksContext` builds them from the translator. Every list is built fresh on each call, so the filter section and the form section count their entries independently.

**Dynamic domains** are the owners found in tasks, the due dates found in active tasks for filters, and the tags found in tasks. Their counts are incremented or decremented as tasks change, and a non-persistent domain is removed when its count reaches zero. Existing filters are cleaned when a selected domain value disappears. A dynamic entry takes its label from the task value itself, so it is never translated.

**The two sections are kept in different orders, because the user reads them differently:**

- Filter lists are a checklist read front to back, so they are sorted by value. Priorities are left in the order they are created, which is already the order they mean.
- Form lists are suggestions the user picks a single entry from, so they are sorted by descending count and then by value, putting the values the user actually uses at the top of the dropdown. Persistent entries come first whatever their count, which is what keeps the `Me` owner entry at the top: it is the default rather than a suggestion.

## 9.5 Sorting

Active tasks have two sorting modes.

**Manual sort by `sortPosition`**, implemented in `src/framework/utils/ManuallySortedList.ts`. Items are inserted or moved by assigning a `sortPosition` between neighboring items where possible, with the step supplied by the caller from `TASKS_CONFIG`. When there is not enough numeric space, the affected positions are recomputed.

**Forced importance sort**, implemented in `src/logic/TasksLogic.ts`. The intended order is:

1. Priority descending: Urgent, High, Normal, Low.
2. Due date presence first.
3. Due date descending when both tasks have a due date, using the stored `YYYY-MM-DD` string order.
4. The existing manual `sortPosition` as fallback.

**Completed tasks are sorted by `completionDate` descending, then by ID.** A completed task stored without a completion date simply sorts last: the comparator must not assume the date is there, because throwing while the loaded tasks are sorted would fail the whole startup load and hide every other task behind a storage error.

## 9.6 Dates

`src/framework/utils/DateUtils.ts` provides day-level date comparison, the start of the current day, the whole-day offset between a date and today, the smart relative labels of `toSmartString()`, `YYYY-MM-DD` conversion in both directions, and the next working day after a given day.

**`toSmartString(date, options)` picks the closest thing the reader recognizes**: the label for today, yesterday or tomorrow; a weekday name for the next `weekdayHorizonDays` days after tomorrow; and a full date for everything else. A label that is not supplied falls through to the next rule, so an application can name only the days it cares about. The framework owns the rules and the application owns the wording: `src/components/tasks/TaskFilters.tsx`, the only place that formats a date this way, builds those options from the translator. The labels come from the `dates` keys of the bundle and the locale comes from `translator.locale`, so the named days and the weekday and full-date wording `Intl` falls back to are always in the same language.

**There is no date context and no current-date React state.** `DateUtils` computes the current day when it is asked, and caches it only until the day changes, which is cheaper than holding it in a provider and cannot go stale in the way stored state does. An application left open across midnight therefore shows correct labels again on the next render, without a timer and without a provider to refresh. What remains is that nothing forces that render: a view left untouched across midnight keeps the labels it last drew until something else re-renders it.

**Stored due dates are always parsed with `DateUtils.fromStandardYearMonthDay()`.** The native `Date` constructor reads `YYYY-MM-DD` as UTC midnight, which shows and stores the previous day in negative UTC offsets, so it must not be used on stored due dates.

---

[← §8 Text and languages](08-text-and-languages.md) · [§10 The application menu →](10-application-menu.md)
