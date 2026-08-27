# §13 — Testing

*[Index](README.md) · [← §12 Styling](12-styling.md)*

---

## 13.1 How much

Testing stays minimal but meaningful: focused unit tests for logic that is worth being sure about, plus one or two smoke tests for a critical user flow. Not a coverage target — a suite that stays fast enough to run on every change, and that fails for a reason.

New logic in `src/logic`, `src/main/storage` and `src/framework` should come with unit tests.

## 13.2 Where they live

| Folder | Holds | May depend on |
| --- | --- | --- |
| `tests/framework/` | The framework's own tests | **Framework modules only**, so they travel with `src/framework` |
| `tests/main/` | Electron main process modules | Anything, with Electron's own API stubbed |
| `tests/logic/` | The pure logic of `src/logic` | Anything |
| `tests/components/` | Rendered React components | Anything, with the preload bridge stubbed on `window` |
| `tests/testUtils/` | Shared factories, re-exported through `index.ts` | Anything |

**The framework rule is the strict one.** A test under `tests/framework` that imports a SPOT module has broken the property the folder exists for: the framework and its tests are meant to be copied into another application together ([§4](04-framework.md)).

## 13.3 What is covered, and why

The test files are the list of what is covered, and they are named after what they cover. What follows is why each area is tested, since that is the part a file name cannot carry:

- **Pure task logic** (`tests/logic`, `tests/framework/ManuallySortedList.test.ts`) is where most of the coverage sits, because it is where a mistake is silent: sort positions, filter matching, domain counting and task cloning all produce a plausible-looking result when they are wrong.
- **The persisted shape of a task** (`TaskComparison`) is tested hard because it decides what reaches SQLite. A field the user cleared has to arrive as `undefined` so it is stored as NULL, and a difference that is never stored must not look like a change.
- **The write path** (`TaskStorageQueue`, `PendingTaskChanges`) is tested for its failure branches rather than its happy one: retries and their bounds, a refused command that must not be retried forever, later commands never overtaking a failed one, and the buffer surviving a task being filtered out, re-rendered or deleted.
- **The audit** (`TaskStateAudit`, `DiagnosticsIpc`) is tested against the same comparison rules as the write path, so the two cannot disagree about what a difference is, and for never reporting one while a change has not reached storage yet. What it found reaching the log file is covered too, since that file is the only place it can still be read after the session, along with the notice naming that file and naming none when logging is unavailable.
- **Storage and the main process** (`tests/main`, the framework storage and backup tests) cover SQLite setup, row mapping, one transaction per command and its rollback, the backup file lifecycle including a copy that reopens as a valid database, and the scheduler's timing rules.
- **Shutdown** (`TaskStorageIpc`, `PendingTaskChanges`) is covered on both handshakes, quit and window close, because the buffered edits are lost if either one is wrong, and both are timing-dependent enough that a reader cannot verify them by inspection.
- **The application menu** (`AppMenu`, `WindowLoadTarget`) is covered for the two things a reader cannot see by looking at a template: that the Edit submenu is always there, since dropping it takes copy and paste away from every task input on macOS, and that no reload or developer tools entry survives into the menu an installed SPOT gets, while a development run keeps Electron's default one untouched. Which platforms draw their own menu bar is covered too, since drawing one where the native bar is still on screen means two of them.
- **The menu bar SPOT draws** (`AppMenuIpc`, `TitleBar`) is covered on both sides, because nothing here falls back to an Electron role. In the main process: that every entry stands on a command something implements and that every implemented command is offered, that each one does what the role of the same name does, that zooming stops at its limits, and that a name the bridge does not know is ignored rather than acted on. In the renderer: that a platform answering with no menu draws nothing at all, that picking an entry runs its command, and that the menu never takes the focus, since the editing entries act on the field it would have taken it from.
- **The failure nets** (`ProcessCrashHandlers`, `WindowNavigationGuard`, `ErrorBoundary`, `AppErrorBoundary`) are covered for the case that matters: that they catch, log and report rather than letting a failure vanish, and that a reporting handler which throws never replaces the failure it was reporting. The crash screen is covered for reaching the log file and for naming it, since it is the only trace of a render error a released build leaves.
- **Translation** (`Translator`, `LanguageResolution`) covers key lookup, interpolation, plural categories a language has that English does not, and the fallbacks, so a missing key fails somewhere rather than reaching the screen.
- **Components** (`tests/components`) are smoke coverage only, on the flows where a regression would be invisible: task list and filter interaction, edit durability across re-render and unmount, task state surviving navigation, and the Settings panel saying where the database is and how to restore it.

## 13.4 The setup file and the conventions

Tests run on Vitest, configured in the `test` section of `vite.config.mts`: it reuses the same `src` alias as the build, runs in `jsdom`, and exposes `describe`, `test`, `expect` and `vi` as globals. `tests/setupTests.ts` is the shared setup file, and `tests/vitest-env.d.ts` is what makes those globals visible to TypeScript.

- **Render through the factories in `tests/testUtils`.** Components that show text need `TranslationProvider` above them, so component tests render through `renderWithTranslations()`. It passes the provider as the Testing Library `wrapper` rather than wrapping the element, so `rerender` keeps it in place. `makeTranslator()` and `makeDomainLabels()` in the same helper supply the English translator and the domain labels the pure logic takes.
- **Assert on English wording**, not on translation keys. English is the bundle that defines the keys, so a key that stops existing has to fail somewhere, and this is where.
- **`tests/setupTests.ts` defines a global `jest` object** holding a single `advanceTimersByTime` helper that forwards to `vi`. That is not leftover Jest: Testing Library decides whether fake timers are installed by probing for a global `jest`, and without one its `findBy` queries poll on timers Vitest has already frozen and hang until the test times out. **The suite itself uses `vi` everywhere.**
- **Stub Electron at the seam.** The main process modules take the parts of Electron they use as options, so a test passes an object rather than mocking the `electron` module.
- **Test the refusal, not only the happy path.** The cases worth writing down are usually the ones that say no: a packaged run ignoring the development server variable, a command the database will never accept, a bridge that does not answer.
- **`TextArea` is replaced by a plain `textarea` mock**, so what [§11.4](11-interface.md#114-common-components) says about pushing a value into MDXEditor is not covered.

## 13.5 Running them

```sh
npm test                                     # all of them
npm test -- tests/logic/TaskComparison.test.ts  # one file, while iterating
```

All three checks have to pass before a feature or a fix is done:

```sh
npm run lint && npm run typecheck && npm test
```

---

[← §12 Styling](12-styling.md)
