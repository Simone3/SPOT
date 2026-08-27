# SPOT

**S**imple **P**lanner & **O**rganizer **T**ool: a small desktop task manager for macOS, Windows, and Linux, meant to manage tasks in a simple and direct way.

No account, no server, no synchronization service. Your tasks live in one local database on your own machine, and SPOT keeps rotated backup copies in a folder you choose.

## Features

- Tasks with a priority, a text, an owner, a due date, and tags.
- Manual ordering by drag and drop, or a forced sort by importance.
- Filters on text, priority, owner, due date, and tags, in a pane you can give as much or as little of the window as you want.
- Completed tasks kept out of the way, and shown again on request.
- Every edit saved as you make it, with a few seconds to change your mind about completing a task.
- Automatic backups, written on a rotation to a folder you pick. That folder is safe to point at a synchronized one.

## Install

SPOT is not signed with a paid Apple or Microsoft certificate, so each operating system will warn you about it the first time. The steps below say what to do about that.

### macOS

Apple Silicon (M1 and later). Intel Macs are not covered by a build yet.

1. Download the `SPOT-darwin-arm64-*.zip` file from the [latest release](https://github.com/Simone3/SPOT/releases/latest).
2. Unzip it and move `SPOT.app` into your `Applications` folder.
3. Remove the quarantine flag macOS put on the download:

```bash
xattr -dr com.apple.quarantine /Applications/SPOT.app
```

4. Open SPOT normally.

Without step 3 macOS refuses to open the application and reports it as damaged. It is not: the flag is applied to everything downloaded from the internet, and macOS only lets you clear it through this dialog or this command when the application carries no paid developer signature.

### Windows

1. Download the `SPOT-Setup.exe` file from the [latest release](https://github.com/Simone3/SPOT/releases/latest).
2. Run it. SmartScreen will say the publisher is unknown: choose **More info**, then **Run anyway**.
3. The installer needs no administrator rights and installs SPOT for your user only. It adds the usual shortcuts and starts the application when it is done.

### Linux

x86-64, Debian and RPM families.

Download the `.deb` or the `.rpm` file from the [latest release](https://github.com/Simone3/SPOT/releases/latest), then install it:

```bash
sudo apt install ./spot_*_amd64.deb
```

```bash
sudo dnf install ./spot-*.x86_64.rpm
```

## Your data

Tasks are stored in a single SQLite database inside SPOT's own application folder, and they are always read from and written to that one file. The Settings page shows you its full path.

The backup folder is separate, and you choose it in Settings. SPOT writes copies of the database there on a rotation and never reads them back, so pointing it at a cloud-synchronized folder is a safe way to keep your tasks off the machine as well. Restoring one is a manual step, and Settings tells you how.

## Documentation

[`docs/technical/`](docs/technical/README.md) is the project reference: architecture, the persistence contract, the data model, the UI structure, and how to build and run SPOT from source. Start from its index.

## License

[Apache License 2.0](LICENSE).
