# §5 — Configuration

*[Index](README.md) · [← §4 Framework layer](04-framework.md)*

---

## 5.1 One file

`src/config/AppConfig.ts` is the single place for app-wide configuration constants: sizes, delays, retry policies, and file or directory names that would otherwise be magic numbers spread across modules. **Both the Electron main process and the React renderer import from it**, so the file must stay free of Node and Electron imports.

Each group is declared `as const`, so consumers that pass a value to a widened parameter may need an explicit type annotation.

## 5.2 The groups

| Group | Holds |
| --- | --- |
| `WINDOW_CONFIG` | The `BrowserWindow` initial (pre-maximize) size, the preload script file name, the built React index path segments, and the environment variable a development run names its renderer server in |
| `TITLE_BAR_CONFIG` | How tall the title bar SPOT draws itself is, and the two colors Electron draws the window buttons it overlays on that row in. Those two mirror `--colors-background-primary` and `--colors-text-primary` in `src/index.css` and have to be changed with them, because the buttons are drawn by the operating system and never reach CSS |
| `ZOOM_CONFIG` | How far one zoom entry of that drawn menu bar moves the Chromium zoom level, and the two levels it stops at |
| `I18N_CONFIG` | The language used when the runtime asks for one SPOT does not ship a bundle for. It must be one of the languages listed in `src/i18n/Translations.ts` |
| `STORAGE_CONFIG` | The database directory name, the SQLite database file name, the current schema version, the SQLite connection timeout, the delay before a failed task write is retried, and how many consecutive database errors on one write are retried before that change is given up on |
| `BACKUP_CONFIG` | The default backup directory name, the backup file prefix and extension, the partial and temporary file names used while a backup is being written, the delay after the last task change before a backup runs, the number of retained backups, and the bounded time the shutdown backup is given |
| `APP_CONFIG_FILE` | The development root directory name and the application configuration file name |
| `LOGGING_CONFIG` | The log directory name, the operational log file name, the maximum file size, and how many rolled archives are kept. The last two bound the log directory together: it holds at most `retainedArchiveCount + 1` files of `maximumFileSizeBytes` each |
| `TASKS_CONFIG` | The task flush delay, the task state change delay, the manual sort position step, and how many days after tomorrow a due date is shown as a weekday name instead of a full date |
| `PANE_LAYOUT_CONFIG` | Where the divider of a resizable split page starts, how much one arrow key press moves it, and the floor width for a pane that holds no header. How narrow a pane may get is measured from the headers it holds, so that floor only applies to a pane with none |
| `AUDIT_CONFIG` | Whether the task state audit runs at all, the delay before its first run, the delay between runs, and how many differing tasks one report lists |
| `DIAGNOSTICS_CONFIG` | How long a single piece of reported text may be before the main process truncates it in the log entry. It bounds the message, the stack and the component stack a render error carries, which the renderer hands over as it is |
| `SHUTDOWN_CONFIG` | The bounded time the main process waits for the renderer to flush its buffered task changes before quitting, plus how many times the renderer flushes its buffer within that wait |

**`SHUTDOWN_CONFIG.rendererFlushTimeoutMs` is derived, not guessed.** It is `STORAGE_CONFIG.writeRetryDelayMs` multiplied by `STORAGE_CONFIG.maximumWriteAttempts` — the whole retry budget of one command — and not a single retry delay: a retry that fails again schedules the next one, and the renderer cannot ask for that retry sooner while it is already waiting for the queue, so a wait covering only one delay would expire while the retry that saves the change has not run yet. The queue gives a change up after that many attempts, so the timeout is also the longest a quit can be held, and only while writes keep failing ([§7.6](07-task-write-path.md#76-shutdown)).

## 5.3 What is not configuration

**User-facing text.** It lives in the translation bundles of [§8](08-text-and-languages.md).

**Developer-facing strings** — log messages, `console` output and the messages of errors only a bug can raise — stay in the module that owns them, and stay in English.

**Anything `src/framework` needs.** The framework never reads this file; SPOT passes the values in where it composes the framework ([§4.2](04-framework.md#42-the-rule-that-keeps-it-liftable)).

---

[← §4 Framework layer](04-framework.md) · [§6 Persistence →](06-persistence.md)
