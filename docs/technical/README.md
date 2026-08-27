# SPOT — technical reference

**Implementation documentation**

How SPOT is built: the processes it runs in, where every file lives, how it is built and released, what the framework layer is, how a task gets from a keystroke into SQLite, and the conventions that only make sense next to the code.

SPOT is the Simple Planner & Organizer Tool: a small Electron + React task manager for macOS, Windows, and Linux, meant to manage tasks in a simple and direct way. Tasks are the finished surface; Notes and Tags are routes that exist but hold placeholder pages. Standalone browser mode is not a supported runtime: the renderer requires the preload bridge and reports storage as unavailable without it.

What is worth knowing before changing anything: task writes are optimistic and queued, the database never moves, and a quit is a handshake rather than an exit. [§6](06-persistence.md) and [§7](07-task-write-path.md) describe each of those.

---

## Contents

| § | Section | What it answers |
| --- | --- | --- |
| 1 | [Architecture](01-architecture.md) | Which process runs what, how the two talk, and what the window is allowed to load |
| 2 | [Repository map](02-repository-map.md) | Where every file is and what it is for |
| 3 | [Build and run](03-build-and-run.md) | The commands, the development loop, packaging, the icons and releasing |
| 4 | [Framework layer](04-framework.md) | What `src/framework` is, what SPOT binds to it, and what may go in it |
| 5 | [Configuration](05-configuration.md) | `AppConfig`, group by group, and what is not configuration |
| 6 | [Persistence](06-persistence.md) | The database, the schema, the backups, the storage contract and the operational log |
| 7 | [The task write path](07-task-write-path.md) | How an edit becomes a row, what happens when a write fails, and how a quit finishes one |
| 8 | [Text and languages](08-text-and-languages.md) | How wording reaches the screen |
| 9 | [Tasks](09-tasks.md) | The task itself, the state around it, and the logic over it |
| 10 | [The application menu](10-application-menu.md) | The native menu, and the menu bar SPOT draws in its place |
| 11 | [The interface](11-interface.md) | The task page, Settings, the shared components and the resizable panes |
| 12 | [Styling](12-styling.md) | The theme, the variables and the focus ring |
| 13 | [Testing](13-testing.md) | What is tested, where the tests live, and what they may depend on |

Sections are added as the application grows.

## How this is organised

```
docs/technical/
├── README.md          this file — the index and the conventions
└── NN-name.md         one Markdown file per section, numbered as the section
```

- **The numbers are stable.** `§4` means section 4, and file names carry the same number so a directory listing reads in document order. A new section takes the next number rather than renumbering the ones already written.
- **Each file is self-contained enough to act on.** Reading one section should be enough to change the area it covers, with cross-references for what it deliberately does not repeat.
- **Rules do not live here.** What Claude Code must and must not do is in [`CLAUDE.md`](../../CLAUDE.md); these pages explain the code, and the two are kept non-overlapping. `README.md` in the repository root is the landing page a user reads: what SPOT is and how to install it, and nothing more.
- **Reasoning is inline.** A decision is explained where the thing it decided is described, because the two are read together.
- **The plan is not here.** `TODO.md` holds the outstanding work and the ideas that have not been committed to. These pages describe the code as it is, never as it is planned to be; a statement about behaviour that is not implemented says so.

## Conventions

- A cross-reference is written `§N` or `§N.M` and links to the file it names.
- File paths are written relative to the repository root, in backticks: `src/main/Main.ts`.
