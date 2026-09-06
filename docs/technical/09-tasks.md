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
- Tag filtering matches if a task has at least one selected tag, or if it has no tag at all and the empty value is selected. The empty value is the `Untagged` entry, the same "no value" convention the owner and due date filters already use.
- Active tasks are refreshed whenever filters change.
- Completed tasks are refreshed only when `showCompleted` is active or when that toggle changes.

## 9.4 Domains

`src/logic/DomainsLogic.ts` builds the option domains for filters and form inputs. A domain entry contains:

```ts
{
	key,
	value,
	labelKind,
	color,
	persistent,
	count,
	priorityCounts
}
```

`priorityCounts` is how many of the counted tasks carry each priority, and it always adds up to `count`. It is what puts a number on every filter button, tinted with the highest priority behind it, so that an owner or a tag holding something urgent says so before it is read ([§11.2](11-interface.md#112-the-task-page)). **A priority entry counts tasks that all carry the priority it names**, so its whole count sits in one bucket and the tint is its own colour: the same rule, read off the same counters, rather than a case of its own.

**This is the one thing that ties the lists to each other.** A task that only changes priority keeps every owner, due date and tag it had, and still moves between their counters, so `updateDomainsForTaskInSection()` runs a handler when the priority changed as well as when the handler's own field did. Removing the old task and adding the new one under the same value is what carries the count from one priority to the other; an entry that falls to zero on the way is removed and rebuilt, which costs nothing because the key of an entry is its value and the keys of the "no value" entries are fixed.

`labelKind` is how the entry is worded, not the wording itself: `VALUE` for an entry named after the task value it was built from, and `PRIORITY`, `NO_OWNER`, `NO_DUE_DATE` or `NO_TAGS` for the ones the tasks never spell out. **`DomainsLogic` therefore holds no text and takes no translator**, and `src/components/tasks/DomainOptions.ts` turns entries into the `{ key, value, label, color, count, countLabel, countColor }` options the select inputs take, wording each kind from the bundle. `TaskFilters` passes it a formatter as well, because a due date is stored as `2026-05-10` and read as `Today` ([§8.3](08-text-and-languages.md#83-reaching-the-translator)).

`countColor` comes from `getHighestPriorityColor()`, which `DomainsLogic` exports because it already owns both the order the priorities mean and the `--colors-priority-*` naming. `countLabel` is what the button is called, since reading out a label followed by a bare number does not say what the number counts.

**The two sections answer two different questions, which is why an entry can be in one and not the other.**

**A filter entry is offered only while an active task matches it.** Every entry is counted, none is permanent, and an entry is removed as soon as its count reaches zero, taking a selected filter with it through `updateFiltersOnDomainsChange()`. That holds for the priorities and for the entries that stand for "no value" just as much as for an owner or a tag someone typed: a filter that would find nothing is not a filter, it is a dead button. So the lists start empty and are built up from the tasks, one entry is offered as readily as ten, and with no tasks at all every list is empty and `TaskFilters` renders the content search and the show-completed toggle alone. Filter domains are counted over active tasks only, so a completed task never puts an entry there, even while `showCompleted` is on.

**A form entry is offered whether or not a task uses it**, because it is what the user picks from while editing: all four priorities, and the `Me` owner. Those are the `persistent` entries, never removed however far their count falls. The rest of the form lists are the owners and tags found across active and completed tasks alike.

**The entries the tasks do not name themselves** are the priorities, `Me`, `None` and `Untagged`. They are worded by their kind while their values are not: the priorities are stored as `URGENT`, `HIGH`, `NORMAL` and `LOW`, and the other three are the empty string, the "no value" convention the whole filter path uses ([§9.3](#93-filtering)).

**Whether an empty value is an entry at all is a section rule, and it is passed as one.** `updateDomainsForTaskInSection()` takes `offersEmptyValueDomains`: true for the filter section, where a task with nothing there is a task the user filters for, and false for the form section, whose lists are the values to type into an input. It only decides whether such an entry is created — the form owners always offer `Me`, and that entry is counted whatever the flag says.

A tag the user has started typing but not finished is an empty value that stands for nothing, so both the domains and the filter read past it: it is not a tag of its own, and it does not stop a task from counting as untagged.

Every list is built fresh on each call, so the filter section and the form section count their entries independently.

**The two sections are kept in different orders, because the user reads them differently:**

- Filter lists are a checklist read front to back, so they are sorted by value. That is what keeps `Me`, `None` and `Untagged` first, since the empty string sorts before anything a user can type. Priorities are the one list whose values mean an order of their own, so they are sorted by that order rather than alphabetically.
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
