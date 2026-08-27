# §4 — Framework layer

*[Index](README.md) · [← §3 Build and run](03-build-and-run.md)*

---

## 4.1 What it is

`src/framework` holds the reusable scaffolding an Electron + React + SQLite desktop application needs regardless of what it stores: logging, crash handling, the database wrapper and its migrations, the storage core, rotated backups and their scheduling, the backup folder feature, the storage IPC chain and shutdown protocol, the renderer write queue, window safety, the translation machinery, a configuration store, and a few utilities. [§2.3](02-repository-map.md#23-srcframework--the-reusable-layer) lists every file in it.

It is kept here, inside SPOT, rather than as a package: the intent is to lift the folder into a second application as it is, and only turn it into a library once the same code has actually served two applications. It has been lifted once already, into Spiccioli, and **the two copies are byte-identical** — that is the standard, not an aspiration. A change that belongs in the framework is made in the framework and then carried to the other copy, never as a local edit that quietly makes one copy the application's. Nothing in the folder names either application, which is what lets the two stay the same bytes.

**Byte-identical means SPOT carries modules it does not use**, and that is the price rather than a mistake: `main/storage/WholeFileStorage.ts`, `main/storage/RetryingFileWriter.ts`, `main/storage/FileBackupRotation.ts` and `utils/Paging.ts` are there because Spiccioli stores its ledger as one JSON document, and Spiccioli in turn carries the SQLite modules SPOT stores tasks with. A module is dropped from the framework when neither application wants it, never because only one does. The same holds for capability inside a shared module: the log level `AppLogger` can be changed at runtime and the number formatting `i18n/Translator.ts` lets an application take over are Spiccioli's, and SPOT leaves both at their defaults.

## 4.2 The rule that keeps it liftable

The rule is one-directional: **`src/framework` must never import SPOT code.** Everything it needs about SPOT arrives through its options. In particular:

- **No `src/config/AppConfig` imports.** Sizes, delays, retention counts, file names and IPC channel names are parameters. SPOT passes them from `AppConfig` at the point where it composes the framework.
- **No SPOT types.** The framework is generic over the command type and the record type it stores; the storage envelope it does fix — status, failure reasons, results — lives in `src/framework/types`.
- **No SPOT wording.** Log messages the framework itself writes are generic; user-facing wording, dialog labels and the messages the renderer shows are supplied by the application, the way `DateUtils` takes its date labels and `BackupDirectory` takes its refusal messages.

ESLint enforces the boundary: `src/framework/**` has a `no-restricted-imports` rule that rejects imports from `src/components`, `src/contexts`, `src/logic`, `src/main`, `src/types`, `src/utils` and `src/config`.

## 4.3 What SPOT binds to it

SPOT binds to the framework in a thin layer of adapters, and those adapters are where SPOT's own names, channels and wording live:

| Framework module | SPOT adapter |
| --- | --- |
| `main/logging/AppLogger.ts` | initialized in `src/main/Main.ts` from `LOGGING_CONFIG` |
| `main/logging/ProcessCrashHandlers.ts` | installed in `src/main/Main.ts`, which reports what they catch |
| `main/config/RuntimePaths.ts` | `src/main/config/SpotRuntimePaths.ts` |
| `main/config/JsonConfigStore.ts` | `src/main/config/SpotConfigStore.ts` |
| `main/config/BackupLocationManager.ts` | composed in `src/main/Main.ts` with the SPOT directory store |
| `main/storage/AppDatabase.ts` | `src/main/storage/SpotDatabase.ts`, which owns the SPOT migration list |
| `main/storage/DatabaseStorage.ts` | `src/main/storage/TaskStorage.ts` |
| `main/storage/BackupScheduler.ts` | composed in `src/main/Main.ts` from `BACKUP_CONFIG` |
| `main/ipc/StorageCommandIpc.ts` | `src/main/ipc/TaskStorageIpc.ts` |
| `main/ipc/BackupLocationIpc.ts` | `src/main/ipc/BackupLocationIpc.ts` |
| `main/window/WindowLoadTarget.ts` | `src/main/window/WindowLoadTarget.ts` |
| `main/window/WindowNavigationGuard.ts` | installed on every window in `src/main/Main.ts` |
| `renderer/StorageQueue.ts` | `src/logic/TaskStorageQueue.ts` |
| `renderer/TranslationContext.tsx` | `src/i18n/TranslationContext.tsx` |
| `renderer/ErrorBoundary.tsx` | `src/components/common/AppErrorBoundary.tsx` |
| `i18n/Translator.ts`, `i18n/LanguageResolution.ts` | `src/i18n/Translations.ts` |

**Not everything reusable was moved.** UI primitives under `src/components` stay in SPOT: they are worth copying into a second application, not sharing from one place.

## 4.4 No module-level state, with two exceptions

The framework holds no module-level state. Everything is created by a factory, so a second application, or a test, can create its own instance.

- **`appLogger`** is the deliberate exception: a process-wide handle the application initializes once at startup, which avoids threading a logger through every call.
- **The memoization caches are the other**: `DateUtils` memoizes the start of the current day and the `Intl` formatters it builds, and `i18n/Translator.ts` memoizes the `Intl.PluralRules` (cardinal and ordinal), `Intl.NumberFormat` and `Intl.ListFormat` objects it builds, keyed by locale. Those caches are pure, so two applications sharing them could not observe each other through them, and the day cache invalidates itself when the day changes.

## 4.5 Adding to it

Put new code here only when it would be just as useful to a different application, and in SPOT otherwise: moving it later is easy, untangling it is not. The test is whether the module can be described without naming a task.

Tests for the framework live in `tests/framework` and use only framework modules, so they travel with the folder ([§13.2](13-testing.md#132-where-they-live)).

---

[← §3 Build and run](03-build-and-run.md) · [§5 Configuration →](05-configuration.md)
