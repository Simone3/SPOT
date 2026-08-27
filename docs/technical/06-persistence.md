# §6 — Persistence

*[Index](README.md) · [← §5 Configuration](05-configuration.md)*

SPOT persists tasks only in the Electron runtime. The main process owns durable storage, operational logging, database health and backups, while React owns the responsive in-memory task state the UI is drawn from. The renderer requires `window.spotStorage` and `window.spotBackupLocation` on startup; opening the React build outside Electron reports storage as unavailable.

**SQLite is the source of truth for task reads and writes.** The append-only operational log is a diagnostic trace of storage commands and SQL activity; startup never rebuilds task state from the log.

What the renderer does with all of this is [§7](07-task-write-path.md).

---

## 6.1 The local database and the backup folder

**The live database always lives on the local user-data disk and is never placed in a folder that a synchronization client controls.** This is the design decision the rest of the persistence layer depends on:

- A synchronization client replaces files behind the process holding them open. When it does so through the usual unlink-and-rename, the SQLite connection keeps reading and writing an unlinked inode: every write reports success and the whole session is lost on quit. Keeping the database local removes that failure entirely.
- Because the database is local, write-ahead logging is safe to use, and its `-wal` and `-shm` companion files never have to be understood by a synchronization client.
- The backup folder only ever receives finished files. Each backup is built locally and published with an atomic rename, so a synchronization client watching that folder cannot observe a database that is still being written.

**The backup folder is therefore a write-only destination.** SPOT never reads a backup back, never compares one against the live database, and does not keep two computers in sync. Restoring a backup is a manual step: with SPOT closed, copy the chosen file over `spot.sqlite` in the database folder. The Settings notice about the backup folder says this too, because a backup nobody knows how to use is not a backup, and it says what the copy costs: every change made after that copy was written is replaced ([§11.3](11-interface.md#113-settings)).

## 6.2 What is in each folder

The paths themselves, and the separate root a development run gets, are in [§1.6](01-architecture.md#16-where-the-installations-own-files-live).

**The database folder** contains `spot.sqlite`, the canonical task database, plus its `-wal` and `-shm` companion files while the application runs, and the temporary backup snapshot, which exists only while a backup is being written.

**The log directory** contains `spot-logs.ndjson`, the newline-delimited operational log entries, and `spot-logs.old.1.ndjson` up to `spot-logs.old.<LOGGING_CONFIG.retainedArchiveCount>.ndjson`, the rolled archives numbered from the newest.

**The backup folder** contains up to `BACKUP_CONFIG.retainedBackupCount` files named `spot-backup-<timestamp>.sqlite`. The timestamp is the ISO instant with colons and dots replaced, so the files sort chronologically by name. Anything else the user keeps in that folder is left alone.

## 6.3 The SQLite schema

`src/framework/main/storage/AppDatabase.ts` opens or creates the database file using Electron's bundled Node `node:sqlite` support. **No external SQLite dependency is used.** The connection is switched to `journal_mode = WAL` right after it is opened, which is safe because the database file never leaves the local user-data disk. The raw SQLite connection stays private to `AppDatabase.ts`; storage uses wrapper methods for SQL execution, row reads, transactions and the backup `VACUUM INTO`.

`src/main/storage/SpotDatabase.ts` supplies the SPOT part: the `spot.sqlite` file name and the migration list, which are applied in ascending version order and refuse a database written by a newer schema. Schema version `1` creates `schema_migrations` and `tasks`:

| Column | Type |
| --- | --- |
| `tasks.id` | `TEXT PRIMARY KEY` |
| `tasks.text` | `TEXT NOT NULL` |
| `tasks.state` | `TEXT NOT NULL` |
| `tasks.priority` | `TEXT NOT NULL` |
| `tasks.owner` | `TEXT` |
| `tasks.due_date` | `TEXT` |
| `tasks.tags_json` | `TEXT NOT NULL` |
| `tasks.sort_position` | `INTEGER NOT NULL` |
| `tasks.completion_date` | `TEXT` |
| `tasks.created_at` | `TEXT NOT NULL` |
| `tasks.updated_at` | `TEXT NOT NULL` |
| `schema_migrations.version` | `INTEGER PRIMARY KEY` |
| `schema_migrations.applied_at` | `TEXT NOT NULL` |

`src/main/storage/TaskRowMapping.ts` maps SQLite rows to React `Task` objects. `tags` are stored as `tags_json`, `completionDate` is stored as an ISO string in `completion_date`, optional string fields are stored as `NULL`, and the runtime-only `visible` flag is not stored. `TASK_FIELD_COLUMN_MAPPINGS` is the shared source for task field names, SQLite column names, mutability, and serialization and parsing behavior. [§9.1](09-tasks.md#91-the-task) describes the task itself.

**`createTaskStorage({ databaseDirectory, backupDirectory })` owns one lazy database wrapper.** It opens it on the first status, load, write or backup operation, reuses it across storage calls, and closes it from `prepareForShutdown()`. **That close is final**: storage never opens the database again, and a status query, a load or a command arriving after it fails with `STORAGE_CLOSED_MESSAGE` instead. Reopening would leave behind a connection nobody closes a second time, and a write-ahead log that is never checkpointed, which is reachable in practice because a command refused as `shutdown` reads the storage status to answer, and because the renderer can still retry a write between the quit drain and the process actually going away.

`readTasksFromDatabase()` in `src/main/storage/TaskRepository.ts` maps each row independently: **a row that fails mapping** — an unrecognized `state` or `priority`, or malformed `tags_json` — **is skipped and logged with `appLogger.warn()`** rather than failing the whole load, so one corrupt row cannot hide every other task behind a storage-unavailable state.

## 6.4 Backups

`src/framework/main/storage/DatabaseBackup.ts` writes one backup, using the file naming and retention count SPOT passes from `BACKUP_CONFIG`:

1. **`VACUUM INTO` a temporary file** in the local database folder. This is the only step that touches the database, it runs in its own read transaction, and it produces a complete self-contained database with no journal and no write-ahead log. **A plain file copy is not used**: it would capture a database mid-transaction, and under write-ahead logging it would silently miss everything still in `spot.sqlite-wal`.
2. **Copy that inert file into the backup folder under a `.part` name.** Nothing is writing to the source, so this copy is safe however slow the destination is.
3. **Rename the `.part` file to its final name.** The rename is atomic within the folder.
4. **Prune the folder** down to the retained backup count, oldest first.

A `.part` file left behind by an interrupted backup is cleared at the start of the next run. Steps 2 to 4 are asynchronous on purpose, so the shutdown timeout can actually abandon a backup whose destination has become slow or unreachable.

`src/framework/main/storage/BackupScheduler.ts` decides when that runs, using the delays SPOT passes from `BACKUP_CONFIG`:

- Every applied task command restarts a `BACKUP_CONFIG.delayAfterChangeMs` timer, so a burst of edits produces one backup once the user has stopped, not one per edit.
- Backups run through `runExclusively()` on the serial storage chain, so a snapshot is never taken while a write transaction is open, and two backups never overlap.
- A backup only runs when something changed since the last one. A failed backup leaves the changes marked as pending so the next run retries them, and a change made while a backup runs schedules the next one instead.
- Shutdown runs one last backup after the in-flight commands are drained and before the database is closed, bounded by `BACKUP_CONFIG.shutdownTimeoutMs`. A backup folder that stopped answering delays the quit by at most that timeout and then loses only that backup: the database is the source of truth and is already saved.

## 6.5 Choosing the backup folder

`src/framework/main/config/BackupLocationManager.ts` owns the backup folder and reports it as a `BackupLocation` with `directory`, `defaultDirectory`, `databaseDirectory`, `databasePath`, `isDevelopment` and an optional `message`.

Startup resolution:

- A packaged run reads `backupDirectory` from the configuration file, creates it when missing, and validates it.
- A packaged run with no saved folder uses the default `<userData>/backups`.
- **A saved folder that cannot be used does not stop anything**: SPOT falls back to the default folder and explains the failure in `message`. Backups are not the source of truth, so an unreachable folder is a notice, not a blocker.
- **A development run always restarts on `<userData>/dev/backups`**, ignoring the folder saved during a previous development session. Changing the folder from Settings still works for testing, and it is written to the development configuration file only.

Changing the folder from Settings validates and creates it, puts the change on the serial storage chain through `runExclusively()` so a backup already being written to the old folder finishes first, saves it in the configuration file, and asks the scheduler for a backup covering the change. Copies already written to the previous folder are left where they are. **Nothing about the database moves**, so React neither flushes nor reloads anything.

The renderer uses the narrow `window.spotBackupLocation` API:

- `getBackupLocation()` returns the current `BackupLocation`.
- `chooseBackupDirectory()` opens the native folder dialog and returns the chosen folder, or a cancelled or invalid result.
- `setBackupDirectory(directory)` applies and saves a folder.
- `setDefaultBackupDirectory()` creates the default folder if needed, then applies and saves it.

## 6.6 The storage contract

`src/main/storage/TaskStorage.ts` defines the storage boundary. It exports `createTaskStorage()`, `TaskStorage`, `TaskStorageCommand`, `OperationalLogEntry` and the storage status and result types. `src/types/TaskStorageTypes.ts` owns the shared command, result, status and `SpotStorageApi` types used across main-process storage, IPC and the renderer declarations.

The preload API:

| Call | Channel | Answers with |
| --- | --- | --- |
| `loadTasks()` | `spot-storage:load-tasks` | `{ ok: true, tasks, status }` or a storage failure |
| `executeTaskCommand(command)` | `spot-storage:execute-task-command` | `{ ok: true, status }` or a storage failure |
| `getStorageStatus()` | `spot-storage:get-storage-status` | The latest database status |
| `onFlushPendingTaskChanges(listener)` | `spot-storage:flush-pending-task-changes` | Subscribes to the shutdown flush request; returns the unsubscribe callback |
| `onBackupStatusChanged(listener)` | `spot-storage:backup-status-changed` | Subscribes to the pushed backup outcome; returns the unsubscribe callback |
| `notifyPendingTaskChangesFlushed()` | `spot-storage:pending-task-changes-flushed` | Reports that the buffered task changes reached storage |

**The supported write commands are `task.create`, `task.update`, `task.delete` and `tasks.updateMany`, and those names are preserved.** Completing and restoring tasks are represented as `task.update` commands, because they update `state` and `completionDate`. Manual reorder and sort by importance use `tasks.updateMany` with a `reason`, such as `manual-reorder` or `importance-sort`.

**Each task write command runs in exactly one SQLite transaction** on the storage-owned connection. Bulk changes must not be split into per-task transactions. Transactions are opened with `BEGIN IMMEDIATE`, never a plain deferred `BEGIN`: the write lock is taken upfront so a concurrent writer on the same database file cannot make the transaction fail with an unrecoverable `SQLITE_BUSY` while it upgrades from a read to a write. The busy handler installed through `STORAGE_CONFIG.databaseTimeoutMs` can then retry the initial lock acquisition normally.

Fields marked immutable in `TASK_FIELD_COLUMN_MAPPINGS`, currently `id`, cannot be included in update changes, and a change that sets a field marked required there to `undefined` is refused the same way. If an update or delete references a missing task row, the command fails and the transaction rolls back. **Every one of those failures is reported as `invalid-command`, not as `database-error`**: none of them would go any differently later, so retrying such a command would never succeed and would keep every task change made afterwards from ever being written, because the write queue never lets a later command overtake a failed one.

Task durability is immediate and does not rely on delayed batching.

**`StorageStatus` reports the database state as `healthy` or `unavailable`**, plus `storageDirectory`, `databasePath` and a `backup` status. Database health is hard: `unavailable` means the tasks may not be saved and React says so prominently. Backup health is soft and separate: `idle`, `ok` or `failed`, with the backup `directory`, the `lastBackupAt` and `lastBackupPath` of the last successful one, and a failure `message`. **A failed backup never makes the database unhealthy**, because the tasks are already saved in the local database either way.

`StorageStatus` also keeps the `not-configured` database state and the `not-implemented` failure reason, which the main process never produces. They are used only by the renderer, to describe a React build opened without the Electron preload API. The remaining storage failures are `database-error`, `invalid-command` and `shutdown`.

## 6.7 Operational logging

`src/framework/main/logging/AppLogger.ts` uses `electron-log` to write newline-delimited JSON entries to the log file of the current run, which for SPOT is `spot-logs.ndjson`. The dependency is wrapped by `createAppLogger()`, while `initializeAppLogger()` installs the concrete logger behind the process-wide `appLogger`. Main-process code can call `appLogger.info`, `appLogger.warn`, `appLogger.error`, `appLogger.debug` and `appLogger.flush` without depending on `electron-log` directly or constructing a logger itself. The file name, size limit and retained archive count are passed in by the application, from `LOGGING_CONFIG`.

**Every run opens with one `config.startup` entry**, written by `src/main/config/StartupConfigurationLog.ts`. A log file otherwise only says what happened, never what it happened in: the version, the runtime, the resolved language, the folders, and the settings behind a backup that was late or a write that was refused are in no other entry, and a file collected from an installed SPOT cannot be asked about them afterwards. It is written once the backup folder has been resolved, so it names the folder that run will actually back up to, and it holds the settings that change how a run behaves rather than every value in `AppConfig`. The folder in use is therefore reported by this entry and not by a `config.backupDirectory` one: that one is written only when the user actually moves the backups somewhere else, since an entry for the folder every startup applies again would say nothing while pushing the entries that do out of the rolled file.

The main process logs every incoming React storage command and every SQL query run by the storage layer, including `SELECT` queries. SQL log entries include the query text, `elapsedMillis`, and success or failure. Query parameters should be logged only when they are useful for debugging and safe to write to disk.

It also logs what the renderer asks it to, which is the two failures the renderer can explain but not fix: **a task state drift**, as a `task.audit` warning holding both task counts, the real difference count and the capped list of differences the audit reported, and **a render error**, as a `renderer.error` entry holding the message, the stack and the component stack. Those are the only renderer-written entries, and the renderer chooses neither their message nor their level.

Example entries:

```json
{"createdAt":"2026-06-02T11:59:59.000Z","level":"info","message":"SPOT started","type":"config.startup","version":"1.0.0","isDevelopment":false,"platform":"darwin","architecture":"arm64","electronVersion":"38.2.2","chromeVersion":"140.0.7339.207","nodeVersion":"22.20.0","locale":"it-IT","language":"en","renderer":{"source":"build","location":"/Applications/SPOT.app/.../build/index.html"},"drawsMenuBar":false,"paths":{"root":"...","config":".../spot-config.json","log":".../logs/spot-logs.ndjson","database":".../storage/spot.sqlite","defaultBackupDirectory":".../backups","backupDirectory":"/Volumes/Backups/spot"},"settings":{"databaseTimeoutMs":5000,"writeRetryDelayMs":5000,"maximumWriteAttempts":5,"taskFlushDelayMs":5000,"backupDelayAfterChangeMs":120000,"retainedBackupCount":5,"backupShutdownTimeoutMs":5000,"logMaximumFileSizeBytes":104857600,"logRetainedArchiveCount":5,"auditEnabled":true,"auditInitialDelayMs":60000,"auditIntervalMs":600000}}
{"createdAt":"2026-06-02T12:00:00.000Z","level":"info","message":"React storage command received","type":"react.command","command":"task.update","payload":{"taskId":"...","change":{"text":"New"}}}
{"createdAt":"2026-06-02T12:00:00.001Z","level":"info","message":"React storage command received","type":"react.command","command":"tasks.updateMany","payload":{"reason":"manual-reorder","updates":[{"taskId":"...","change":{"sortPosition":1000}},{"taskId":"...","change":{"sortPosition":2000}}]}}
{"createdAt":"2026-06-02T12:00:00.003Z","level":"info","message":"Storage SQL query completed","type":"sql.query","query":"UPDATE tasks SET text = ? WHERE id = ?","elapsedMillis":2.4,"result":"success"}
{"createdAt":"2026-06-02T12:01:00.000Z","level":"warn","message":"The tasks on screen and the tasks in the database are not the same","type":"task.audit","stateTaskCount":12,"databaseTaskCount":12,"differenceCount":1,"differences":[{"taskId":"...","taskText":"Renew the passport","reason":"different-values","fieldNames":["dueDate"]}]}
{"createdAt":"2026-06-02T12:02:00.000Z","level":"error","message":"A render error left the window with nothing to show","type":"renderer.error","error":"Cannot read properties of undefined","stack":"TypeError: ...","componentStack":"    at TasksList\n    at TasksPage"}
```

**Rolling is the logger's own.** `electron-log` only ever keeps one archive, so keeping `LOGGING_CONFIG.retainedArchiveCount` of them is done in `createArchiveLogFn()`: each archive moves one place down, the oldest falls off the end, and the file that just filled up becomes `spot-logs.old.1.ndjson`. The log directory therefore holds the current file plus at most that many archives, which bounds the whole directory at `retainedArchiveCount + 1` times the size limit. A count of `0` keeps no archive and simply discards the filled-up file, which still has to happen for the transport to reopen an empty one. A rotation that fails is ignored exactly like a write that fails.

**It writes synchronously**, so an entry is on disk before the call that logged it returns and the entries describing a crash survive it. Logger write methods return `void`; normal callers do not await operational logging or inspect write outcomes. **The outcome of a write is deliberately not checked, and a failed write is simply lost**: the log is a diagnostic trace and never a source of truth, so reading the file back to confirm every line would cost far more than writing it, on every statement of every transaction, to protect something the persistence contract already allows to fail. There is no retry either, because nothing reports a failure to retry. The one failure the logger does handle is an entry holding a value JSON cannot represent, which is swallowed rather than raised at the caller.

`flush()` is reserved for shutdown preparation. Nothing is ever pending, so it resolves immediately; it stays part of the logger so shutdown keeps one place to wait on, and so a buffering transport could be introduced later without changing its callers.

---

[← §5 Configuration](05-configuration.md) · [§7 The task write path →](07-task-write-path.md)
