# §1 — Architecture

*[Index](README.md)*

---

## 1.1 Two processes

SPOT is an Electron application, so it runs as two processes with different powers, and every feature has to be placed in one of them.

- **The main process** is Node. It is the only side that can touch the filesystem, open the SQLite database, open dialogs, read the application's own version or write the operational log. It owns the window and decides what that window is allowed to load. Its entry point is `src/main/Main.ts`.
- **The renderer** is a Chromium page running React. It has no Node access at all. It owns the responsive in-memory task state the UI is drawn from. Its entry point is `src/index.tsx`.

Between them sits **the preload script**, `src/main/preload/Preload.ts`. It runs in the renderer's context with access to Electron's IPC and publishes a small, explicit object on `window` for the page to call. It does not expose raw `ipcRenderer`, filesystem, SQLite, or dialog objects: the renderer cannot reach a module the preload did not expose, and the preload exposes functions rather than handles.

Persistence in that split is described in [§6](06-persistence.md), and what the renderer does with it in [§7](07-task-write-path.md). The two processes are bundled separately and by different tools, because they are different targets — see [§3.3](03-build-and-run.md#33-two-bundles-two-bundlers).

## 1.2 What crosses the bridge

Five narrow APIs and nothing else. Each one follows the same pattern: the channel names in a `src/types/…IpcChannels.ts` file shared by both sides, the shapes in a types file beside it, a handler under `src/main/ipc/`, and the preload publishing one function per thing the renderer may ask for — so preload and main-process handlers cannot drift apart.

| Published as | Files | Role |
| --- | --- | --- |
| `window.spotStorage` | `src/types/TaskStorageIpcChannels.ts`, `TaskStorageTypes.ts`, `src/main/ipc/TaskStorageIpc.ts` | Loading the tasks, executing one task command, the storage status, the pushed backup status, and the shutdown flush handshake ([§6.6](06-persistence.md#66-the-storage-contract)) |
| `window.spotBackupLocation` | `src/types/BackupLocationIpcChannels.ts`, `BackupLocationTypes.ts`, `src/main/ipc/BackupLocationIpc.ts` | Where the backups go: reading the location, the native folder dialog, and choosing a folder ([§6.5](06-persistence.md#65-choosing-the-backup-folder)) |
| `window.spotAppInfo` | `src/types/AppInfoIpcChannels.ts`, `AppInfoTypes.ts`, `src/main/ipc/AppInfoIpc.ts` | Which build the renderer is part of |
| `window.spotAppMenu` | `src/types/AppMenuIpcChannels.ts`, `AppMenuTypes.ts`, `src/main/ipc/AppMenuIpc.ts` | **Only where the window has no menu bar of its own**: what the renderer draws in its place, and the closed set of commands a drawn entry asks for ([§10](10-application-menu.md)) |
| `window.spotDiagnostics` | `src/types/DiagnosticsIpcChannels.ts`, `DiagnosticsTypes.ts`, `src/main/ipc/DiagnosticsIpc.ts` | The two failures the renderer can explain but not fix, written into the operational log by the process that owns it |

`src/vite-env.d.ts` tells TypeScript what `window` carries.

A channel is a request the renderer makes and the main process answers. For events pushed the other way, the framework's `subscribeToChannel` (`src/framework/preload/IpcBridge.ts`) is what the preload wraps a listener in, so the renderer gets the payload without an Electron event object it could not receive anyway. Two events are pushed today: the request to flush the buffered task changes before the session closes, and the outcome of a backup — backups run on a timer, long after the command that triggered them was answered, so their outcome is pushed instead of riding on a command result.

**`spotDiagnostics` is deliberately not part of `spotStorage`.** It stores nothing and reads nothing, and what it hands over is only useful to someone reading the log file afterwards. It carries `reportTaskStateDrift()` and `reportRenderError()`, and **the main process decides what is written and at which level**: every entry is bounded, by `AUDIT_CONFIG.maximumReportedTasks` for a drift and by `DIAGNOSTICS_CONFIG.maximumReportedTextLength` for the message, stack and component stack of a render error, so nothing the renderer sends can grow one log line without limit. Both calls answer with the path of the log file they wrote to, or with nothing when logging is unavailable, which is the only way the renderer can name that file to the user. `src/logic/Diagnostics.ts` is the renderer side of both: it is the only module that touches that bridge, and it swallows every failure, because its callers are already showing the user something worse.

**The version is asked of the main process rather than read from `package.json` at build time**, because `app.getVersion()` is what the running application actually reports: a renderer bundle built separately could otherwise name a version the installed copy does not have. `src/main/ipc/AppInfoIpc.ts` registers the one handler, and it reads the version on every request instead of capturing it once.

## 1.3 The renderer tree

`src/index.tsx` mounts:

```
TranslationProvider          the translator every component reads wording from (§8)
  └── AppErrorBoundary       catches a render failure so the window is never left empty
      └── BackupLocationContextProvider   where the copies go (§6.5)
          └── TasksContextProvider        the task state, the write path and the audit (§7, §9)
              └── TitleBar                the window row, where SPOT draws one (§10)
              └── HashRouter
                  └── Sidebar + MainContent
```

Routes: `/` renders `TasksPage`, `/notes` renders `NotesPage`, `/tags` renders `TagsPage`, `/settings` renders `SettingsPage`.

`Sidebar` links only Tasks and Settings. Notes and Tags keep their routes and their placeholder pages, but nothing navigates to them: a released SPOT should not offer a page that does nothing. Restoring them is putting their `SidebarElement` back.

**Every context provider is mounted above `HashRouter`**, so route state is the only thing navigation changes. Page components hold what only they need: anything that must survive navigation belongs to a provider. There is no single application-wide store, because a shared one would re-render every page on any change; each provider owns one area.

Nothing gates the application at startup: the database is always in the user-data folder, so the task page renders right away and the backup folder is only a Settings concern.

**`AppErrorBoundary` sits directly under `TranslationProvider` and above everything else**, so a render error anywhere below it, including in a context provider above the router, shows a message and a reload button instead of the blank window React leaves behind when nothing catches a throw. It wraps the whole application rather than one page because the providers above the router are exactly where a failure would otherwise be unrecoverable. Reloading is the only recovery it offers: rendering the same tree again would usually throw the same error a second time, while a reload starts over from the tasks the database holds. It says so too, and promises nothing about what was being typed at that moment.

The failure itself is reported through `spotDiagnostics`, because the window is showing this screen instead of the application and the renderer console it could otherwise write to is developer-facing and cannot be opened in a packaged run. `reportRenderError()` in `src/logic/Diagnostics.ts` reduces the thrown value to a message, a stack and the component stack React caught it with, since anything can be thrown and IPC only carries what can be cloned, and the crash screen then names the log file the main process answers with. It says nothing about a log file until that answer arrives, and says the error could not be written when none was named, rather than pointing at a file that may hold nothing. The report is fire-and-forget: it runs from `componentDidCatch`, which must not throw, and a diagnostics call that failed must never replace the failure it was reporting.

`TitleBar` is mounted above `HashRouter` with the providers, because it is part of the window and not of a route. It renders nothing unless the main process hid the native title bar and answered with a menu to draw, which today only happens on Windows: everywhere else the tree below `#root` is the one it has always been. [§10](10-application-menu.md) explains why, and [§11.1](11-interface.md#111-the-page-layout) describes the layout below it.

## 1.4 What the main process does at startup

**One kind of launch is not the user's at all and is turned away before anything else is considered.** The Windows Squirrel installer runs SPOT itself to create and remove its shortcuts, naming the step on the command line. `electron-squirrel-startup` does that step at import time and reports that it did, and `Main.ts` then quits instead of opening a window in the middle of an install, an update or an uninstall. It comes before the lock because the installer can run those steps while SPOT is already open, and a launch that took the lock would have to be a second instance to do anything at all. The value is false on every other platform and on every ordinary launch, so nothing else changes.

**Only one SPOT process runs at a time.** `Main.ts` takes Electron's single instance lock next, before anything else, and a launch that does not get it quits immediately, before `ready`, so it opens no database, writes no log file and schedules no backup. The instance holding the lock receives `second-instance` instead and reveals its own window: restored if minimized, shown and focused otherwise, unless it is already shutting down and has hidden that window on purpose.

A second instance is prevented rather than supported because nothing in the persistence design accounts for one. Two processes would hold the same `spot.sqlite` open, and SQLite would keep the file consistent between them, but the two task states would not: each renderer reads the tasks once at startup and writes optimistically afterwards, so every change one process saves is invisible to the other, whose own writes then go on top of it. A task deleted in one instance makes the other's next write of it fail, because the repository requires each command to change exactly one row. The audit would report all of this as a drift for the rest of the session, which is exactly what it cannot tell apart from a real one. The two backup schedulers would also prune each other's backups and clear each other's `.part` files mid-copy, and the two loggers would rotate the same log file underneath each other.

Operating systems disagree on how easily a second launch happens, which is why the lock is taken rather than left to them: macOS refuses a second launch of the same bundle from Finder or the Dock but not `open -n`, while Windows and Linux start as many processes as the user asks for. The lock is keyed on the Electron user-data folder, so a development run and an installed SPOT exclude each other even though they keep their files in separate roots.

`src/main/Main.ts` is the composition root. In order, it:

1. **Installs the process crash handlers** from `src/framework/main/logging/ProcessCrashHandlers.ts`, before anything can fail. Startup runs inside a promise, so an exception there would otherwise leave no window and no trace ([§7.5](07-task-write-path.md#75-where-failures-go)).
2. **Resolves the language**, as the very first thing after Electron is ready, so that every failure from here on has wording to report itself with ([§8.3](08-text-and-languages.md#83-reaching-the-translator)).
3. **Resolves the window load target** with `resolveWindowLoadTarget()` — the built `build/index.html` or the development server — once and for the whole run, because the application menu is decided from it and because every window this run creates then loads the same page.
4. **Resolves the runtime paths** with `resolveSpotRuntimePaths()` ([§1.6](#16-where-the-installations-own-files-live)) and **initializes `appLogger`** into them with the `LOGGING_CONFIG` settings.
5. **Creates the task storage** on the runtime database folder and **registers the storage IPC handlers** from `src/main/ipc/TaskStorageIpc.ts`, which also attach the storage shutdown drain to Electron's `before-quit` event, the backup scheduler, and the backup location handlers from `src/main/ipc/BackupLocationIpc.ts`.
6. **Resolves the backup folder** through `BackupLocationManager.initialize()`, then **logs the startup configuration**, so the entry names the folder this run will actually back up to ([§6.7](06-persistence.md#67-operational-logging)).
7. **Installs the application menu** in place of Electron's default one, and decides whether SPOT draws its own menu bar instead of showing that one ([§10](10-application-menu.md)).
8. **Creates the window**, hidden and maximized to the screen work area on its `ready-to-show` event before being shown, so it starts at full screen size without engaging macOS's separate native fullscreen window state. Whether SPOT draws its own menu bar is passed to `createWindow()`: it is what hides the window's title bar and its native menu bar, which cannot be done to a window that already exists.

The scheduler and the storage IPC handlers need each other: the handlers return the serial storage chain the scheduler runs backups on, and the scheduler provides the callbacks the handlers use to restart the backup delay after an applied command and to run the shutdown backup. `Main.ts` resolves that by registering the handlers first with callbacks that read a scheduler variable assigned right afterwards.

`Main.ts` also intercepts every window's own `close` event and passes `onRendererFlushCompleted` to the storage IPC handlers, which is what makes a quit and a window close save the buffered edits first. [§7.6](07-task-write-path.md#76-shutdown) describes both handshakes.

## 1.5 What the window is allowed to load

Two independent restrictions, because they answer different questions.

- **The Content-Security-Policy in `index.html`** says what the page may load. It is strict, and Vite relaxes it for the development server's page only ([§3.5](03-build-and-run.md#35-the-content-security-policy-and-why-there-are-two)).
- **The navigation guard**, `installWindowNavigationGuard()` from `src/framework/main/window/WindowNavigationGuard.ts`, says where the page may go. A CSP does not stop a link, a script or an embedded editor from navigating the whole renderer elsewhere, and that page would sit behind the same preload bridge. The guard denies every window the page tries to open, since nothing in SPOT opens a second one, and prevents every whole-page navigation to anything but the page the window was loaded with. Everything refused is logged as `blocked-navigation`.

`HashRouter` is unaffected, because a route change moves through the fragment and stays on the same document, which never raises `will-navigate`. A development run is allowed anywhere on its server's origin, since the server reloads the renderer at paths of its own, while a built run is matched on the `file://` path of `build/index.html` alone.

On top of both: the development server URL is read from the environment, and a packaged run ignores it entirely. Honouring it there would let anything that can set an environment variable put a page of its own choosing behind the preload bridge.

## 1.6 Where the installation's own files live

`src/main/config/SpotRuntimePaths.ts` names the SPOT folders and files and resolves them through the framework runtime paths, inside Electron's user-data folder:

| | Packaged run | Development run |
| --- | --- | --- |
| Root | the user-data folder | a `dev/` folder inside it |
| Configuration file | `<userData>/spot-config.json` | `<userData>/dev/spot-config.json` |
| Log directory | `<userData>/logs` | `<userData>/dev/logs` |
| Database folder | `<userData>/storage` | `<userData>/dev/storage` |
| Default backup folder | `<userData>/backups` | `<userData>/dev/backups` |

A development run keeps its own root so it never touches the real configuration, the real database or the real logs. [§6.2](06-persistence.md#62-what-is-in-each-folder) describes what each folder holds.

**The live database never moves**, and the user-data folder is named after `productName`, which is why that name is fixed once SPOT is installed anywhere ([§3.6](03-build-and-run.md#36-packaging-and-application-identity)).

---

[§2 Repository map →](02-repository-map.md)
