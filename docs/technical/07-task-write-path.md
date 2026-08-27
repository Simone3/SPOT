# §7 — The task write path

*[Index](README.md) · [← §6 Persistence](06-persistence.md)*

How a keystroke becomes a row, what happens when a write fails, and how a quit finishes one. The storage side of all this is [§6](06-persistence.md).

---

## 7.1 What the renderer does

React calls `loadTasks()` through `window.spotStorage` once on startup and calls `executeTaskCommand()` for task mutations. **The database never moves, so there is nothing that makes React reload it.**

It updates optimistically for normal task changes, keeps the latest renderer-facing `StorageStatus`, stays quiet while the database is healthy, shows startup storage failures before rendering task lists, shows a prominent save warning when writes fail, and shows a quieter notice when backups fail. It calls `loadTasks()` again only for the periodic audit of [§7.4](#74-auditing-the-task-state), which reads without ever writing what it read into the task state.

## 7.2 Writing task changes

`src/logic/TaskStorageQueue.ts` owns every task write. It creates the single renderer queue from `src/framework/renderer/StorageQueue.ts`, supplying the bridge to `window.spotStorage`, the `STORAGE_CONFIG` retry policy and the warning wording. **Commands are queued and written one at a time and in order**, so a write that fails cannot be overtaken by later ones.

What a command carries is decided by `src/logic/TaskComparison.ts`, which owns the persisted shape of a task and the comparison of two of them: `taskToPersistedTask()` reduces a task to what the database holds, normalized the way the database holds it, and `createPersistedTaskChange()` keeps only the fields whose stored value differs. **A field the user cleared is present in the change and `undefined`**, which is what stores it as NULL. The audit compares by exactly the same rules.

- A write that fails with `database-error`, or whose call throws, **stays at the front of the queue and is retried** every `STORAGE_CONFIG.writeRetryDelayMs`. A database that failed once can work again, and the change is not lost in the meantime.
- Those retries are **bounded by `STORAGE_CONFIG.maximumWriteAttempts`** consecutive database errors on the same command. Not every database error clears: a constraint violation or a full disk fails the same way every time, and an unbounded retry would keep that command at the front of the queue and leave every change made afterwards unwritten for the rest of the session. After the last attempt the command is given up on and reported with its own warning, which says the change is not stored, so the queue can move on.
- A write **refused as `shutdown` was never attempted**, so it stays queued and retried too, is never counted against the retry limit, and is never counted as a change storage will not accept.
- A write **refused as `invalid-command`** would be refused again in exactly the same way, so it is dropped instead of retried.
- `retryTaskStorageQueueNow()` writes the queue again immediately instead of waiting out the retry delay. The flush handshake calls it, because the main process waits for a bounded time and a pending retry could use all of it up.
- **A failed write does not touch the task state.** The state holds what the user wanted, and reading the database back over it would throw that away, so React keeps it and only warns. There is no reconciliation and no reload after a write failure.
- **The warning lives as long as the change is unwritten**: it is cleared when the queue drains, never by an unrelated command that happened to succeed. A dropped command warns for the rest of the session, because that change will never be written and tasks are only loaded at startup. `clearTaskStorageFailures()` forgets those warnings and is meant for a reload that has succeeded; nothing calls it today.
- **Successful writes are silent.** There is no saving or saved indicator.

## 7.3 Buffered task changes

Task edits are not sent to the task state on every keystroke. `src/logic/PendingTaskChanges.ts` holds them in a buffer keyed by task ID, **outside the component tree**, so that they cannot be lost when a task component re-renders, is filtered out, or unmounts.

- Task components read the buffer through `useSyncExternalStore` and render the task state merged with it. The rendered value is derived from both on every render, so the inputs and the task state can never drift apart.
- Only the components of the edited task re-render while the user types, because subscribers are registered per task ID.
- **Every buffered value carries a flush mode.** A `delayed` change is saved after `TASKS_CONFIG.flushDelayMs`, or after the shorter `TASKS_CONFIG.stateChangeDelayMs` when it is a pending state change, and restarts that delay on every new change. An `immediate` change is saved right away. A `buffered` change only waits in the buffer: it neither starts nor postpones a save, and it is saved by the next save of the same task, by leaving the input, or by the final flush. A value brought back to the one already in the task state is dropped from the buffer.
- Tags use the `buffered` mode while the user types, so a half-typed tag never reaches the database on its own, and the `immediate` mode when the user leaves the tag input.
- `TasksContextProvider` registers the single applier that saves buffered changes. It looks the task up by ID in the current task state, so changes are always applied to the task as it is at save time, and a task that no longer exists is skipped.
- `TasksContextProvider` clears the buffer of a deleted task. It lives as long as the renderer, so leaving the task page no longer unregisters the applier and no longer has to flush anything first: buffered changes keep saving normally while the user is on another page.
- **A save takes out of the buffer only what it is actually saving.** Anything the user typed in the meantime and that is not part of that save stays buffered.
- Buffered changes are never dropped when no applier is registered: they stay buffered until one is.
- **An applier that throws saved nothing**, so what the save took out of the buffer goes back into it. The buffer is the only place those values still exist at that point, and values buffered while the applier ran are newer and win field by field.
- The flush of the whole buffer saves each task on its own: one task that cannot be saved is reported to the console and leaves its values buffered, while the other tasks are still saved. It never throws, because its callers are the renderer going away, the page hide and the provider teardown, none of which can do anything about a failure. A single-task save still reports it to its caller.

## 7.4 Auditing the task state

Task updates are optimistic and tasks are only read at startup, so nothing in a running session would notice a change that never reached the database: the task state keeps showing it, and the next launch is the first thing that does not. The audit closes that window. **It is a first-period safety net**, switched on through `AUDIT_CONFIG.enabled` and meant to be switched off once the write path has been trusted for a while, not a part of that write path.

`TasksContextProvider` schedules it. `AUDIT_CONFIG.initialDelayMs` after the startup load, and every `AUDIT_CONFIG.intervalMs` after that, it reads the database back through the existing `loadTasks()` and hands both sides to `auditTaskState()` in `src/logic/TaskStateAudit.ts`. **The read needs no channel of its own**: `loadTasks()` already runs on the serial storage chain, so it is ordered behind the commands and backups already running and can never observe a half-applied transaction. Only reporting what the audit found goes elsewhere, through `spotDiagnostics`, and it never touches the database or that chain.

- The audit **reschedules itself when it finishes** instead of running on an interval, so a read waiting behind a write or a backup can never have another one queued up behind it.
- **It only runs when the task state has nothing left to write**: the pending-changes buffer is empty, the storage queue is idle, and no change is reported as unsaved. Until then the task state is ahead of the database because that is how the write path works, and an audit would report the design as a defect. `isTaskStorageQueueIdle()` answers the queue part of that question without waiting for it, because an audit that has to wait has nothing to do in the meantime and is better skipped.
- It also **skips a hidden window**, so it never starts a read while the application is quitting.
- The user can change anything while the database is being read, so the task state carries a **generation counter** that `commitTaskState()` bumps. An audit whose generation moved, or whose quiescence no longer holds when the read returns, is dropped rather than reported: it would be reporting the change it raced.
- **A read that fails is not a drift.** The storage status already reports a database that cannot be read, so the audit stays quiet about it.

`auditTaskState()` compares only what the database holds, through the same `taskToPersistedTask()` in `src/logic/TaskComparison.ts` that decides what a write sends. **That shared definition is the point**: an audit with its own idea of equality would find differences the write path never had any reason to store. It reports three kinds of difference — `missing-in-database`, `missing-in-state`, and `different-values` with the differing field names — capped at `AUDIT_CONFIG.maximumReportedTasks` while the reported count stays the real total.

**What it finds is reported and never reconciled.** The task state holds what the user wanted, and the audit has no way of knowing which of the two sides is the mistaken one, so overwriting either would be guessing. A drift is shown in the task page as a notice, below every failure that means something is not being saved right now. The notice stays for the rest of the session: the audit is there to make sure a drift is not discovered by the next launch, and a later write that happens to paper over it does not make it not have happened.

The notice can only say how much drifted, so the tasks and the fields behind it are written to the operational log, and **the notice names that file**. It says how many tasks are not stored yet, are stored but not shown, or are stored with different values, and then where to read which ones they are. The renderer cannot write that file itself, and the developer console it can reach exists only in a development run and outlives nothing, so `TasksContextProvider` hands the report to `src/main/ipc/DiagnosticsIpc.ts` through `reportTaskStateDrift()` in `src/logic/Diagnostics.ts` and words the notice with the log file path that call answers with. **`src/logic/Diagnostics.ts` is the only renderer module that touches `window.spotDiagnostics`**, so a caller reporting a failure never handles a missing bridge or a rejected call itself, and there is one place to look for everything the renderer can put in that log. The main process, not the renderer, decides what each entry says, at what level, and how large it may get ([§6.7](06-persistence.md#67-operational-logging)). A report the main process could not take, or a logger that could not open its file, leaves the notice saying only that the details are in the log file: the drift itself is still reported, because a report that cannot be written is not a reason to hide what the audit found.

`src/logic/TaskComparison.ts` also normalizes an optional field the user emptied to `undefined`, because that is what the database stores it as and reads it back as. Without it, clearing an owner or a due date would send a change the database is already holding, and would then look like a drift on every audit for the rest of the session.

## 7.5 Where failures go

**Database write failures are user-facing.** The SQLite transaction must not partially commit and the main process reports the failure to React, which keeps the task state, retries the write and warns the user. Database read or startup failures are also user-facing; React receives a storage error state instead of silently falling back to stale persisted data. Database folder failures must leave persistence visibly non-healthy rather than pretending data is saved.

**Backup failures are user-facing too, but never alarming.** They are logged, reported through the pushed backup status, and shown as a notice in the task page and in Settings, always stating that the tasks themselves are saved. A backup failure must never be routed through the database error path.

**Operational-log failures are not renderer-facing.** Startup log file open failures are tracked internally by `AppLogger`, and runtime log write failures are neither detected nor retried: the entry is lost while SQLite keeps succeeding. The two messages that name the log file are the one exception, and only because they would otherwise send the user to a file that holds nothing: a drift notice and the crash screen say the report could not be written when the main process named no file, which is exactly the case in which logging was unavailable. Neither one is a report of the logging failure itself, and neither one waits on the log write: what they had to say is shown either way.

**A render error never empties the window.** `AppErrorBoundary` catches it, shows a message and a reload button, and reports it into the operational log ([§1.3](01-architecture.md#13-the-renderer-tree)).

**The failures none of those paths know about are caught by the process crash handlers** `Main.ts` installs from `src/framework/main/logging/ProcessCrashHandlers.ts`, before anything can fail. An exception reaching the top of the main process, or a promise nobody handled, would otherwise take the window down or vanish without a word, and there would be nothing afterwards to tell those two apart. Both are logged as `uncaught-exception` or `unhandled-rejection` with their stack, and reported to the user in a native error box, because a main-process failure may leave no window to show anything in. **Only the first one opens a box**: a process that started failing usually keeps failing, and a stack of error boxes would bury the window instead of saying anything the first one did not.

**Startup is the case that needs this most**, because it runs inside a promise: anything that throws while resolving the runtime paths, opening the database or resolving the backup folder happens before the window exists, so without this SPOT would simply never appear and leave nothing behind to explain it. That promise therefore has a `catch` of its own that logs the failure as `startup-failed`, reports it, and quits, rather than leaving a process running with nothing on screen. The language is resolved as the very first thing after Electron is ready, before any of that, so that every failure from there on has wording to report itself with. A failure earlier than that is a failure to start at all, with no logger and no translator yet, and can only be left to the platform.

Installing an `uncaughtException` handler stops Node from exiting on one, and **SPOT keeps it that way on purpose for failures after startup**: the window is still up, its close handshake still saves the buffered edits, and killing the process would lose them. The framework only logs and reports; whether to quit is the application's decision at each site.

## 7.6 Shutdown

`src/main/ipc/TaskStorageIpc.ts` registers a `before-quit` drain. The first quit request waits for in-flight task write commands, runs the last backup under its bounded timeout, calls `prepareForShutdown()` so the SQLite connection closes, flushes the process-wide logger, and then resumes quitting. New write commands after shutdown begins return a `shutdown` failure instead of being enqueued behind the quit drain.

React buffers task edits for a few seconds, so that drain would close the database while the user's last keystrokes are still in the renderer. **The first quit request therefore starts with a renderer flush handshake:**

1. The main process sends `spot-storage:flush-pending-task-changes` to the window and waits.
2. **Task write commands keep being accepted during that wait**, because refusing them is exactly what would lose the buffered edits.
3. React saves every buffered task change, retries a write that failed earlier instead of waiting out its retry delay, and waits for the resulting storage commands. The window is still interactive throughout that wait, which lasts seconds whenever a write is being retried, so **the buffer is flushed again after every wait**, for up to `SHUTDOWN_CONFIG.maximumRendererFlushRounds` rounds: a single flush would lose whatever the user typed while the queue was still busy. The rounds are bounded because someone who keeps typing must not be able to hold the quit open forever, and because a change nothing can apply stays buffered no matter how often it is flushed. Only then does React invoke `spot-storage:pending-task-changes-flushed`.
4. Only then does the main process hide the window, refuse further commands, drain the in-flight ones, close the database and flush the logger.

**The window is hidden through the `onRendererFlushCompleted` hook**, which `Main.ts` supplies, at the exact moment commands start being refused. What follows takes seconds, and all of `BACKUP_CONFIG.shutdownTimeoutMs` when the backup folder stopped answering. A window left on screen stays interactive for that whole time while every task change it collects is refused as `shutdown`, queued for a retry the process will not live to run, and lost with a warning nobody has time to read. Hiding it is what keeps the last seconds of a quit from silently dropping edits.

The renderer reports the flush as done once the rounds are used up, even when something is still buffered, because a change nothing can apply would keep the quit open forever. **It writes those task IDs to the console first**: the values only exist in the buffer at that point and go away with the renderer, so giving up on them is never silent.

The wait is bounded by `SHUTDOWN_CONFIG.rendererFlushTimeoutMs`, so an unresponsive or already destroyed renderer delays the quit by at most that timeout. That timeout outlasts `STORAGE_CONFIG.writeRetryDelayMs` on purpose ([§5.2](05-configuration.md#52-the-groups)): a write sitting on its retry delay when the quit starts must still fit in the wait, or a single transient database failure plus a quit would lose the change. When no renderer is wired at all, shutdown starts immediately and later commands are refused right away.

**Closing the window runs the same handshake**, through `requestRendererFlushBeforeWindowClose()`, which `Main.ts` calls from the window `close` event. Closing is the usual way of leaving the application and it destroys the renderer, on Windows and Linux before `before-quit` ever runs and on macOS without quitting at all, so the handshake cannot be left to the quit path alone. The two differ in what follows: a window close only saves the buffered edits and then destroys the window, while a quit also refuses later commands, drains, backs up and closes the database. The window close therefore keeps accepting task commands afterwards, because the application may still be running.

A window closing while a quit starts, or the other way around, **joins the handshake already running** instead of asking the renderer twice. A window that closes while the quit handshake is still waiting for the renderer joins it too and waits: destroying the window right away would tear the renderer down halfway through the flush the quit is waiting for, and lose whatever it had left to write. `requestRendererFlushBeforeWindowClose()` returns nothing, and the window closes immediately, only once that handshake is done or when the quit had no renderer to ask in the first place.

`installPendingTaskChangesFlushHandler()`, installed once when the renderer starts, answers that request and also saves the whole buffer on the window `pagehide` event. **The page hide save is only a last resort**: the renderer is being torn down at that point, so the storage commands it queues cannot all be delivered, which is exactly why the close interception exists.

---

[← §6 Persistence](06-persistence.md) · [§8 Text and languages →](08-text-and-languages.md)
