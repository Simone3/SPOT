# §3 — Build and run

*[Index](README.md) · [← §2 Repository map](02-repository-map.md)*

---

## 3.1 Requirements

Node 24 or later, which is what `engines.node` in `package.json` asks for. That floor matches the Node version Electron bundles, so the main process is developed and tested against the runtime it actually ships on, and it clears the minimums Electron itself, `@electron/fuses` and `@testing-library/jest-dom` declare. Then:

```sh
npm install
```

## 3.2 The commands

```sh
npm run lint           # ESLint flat config
npm run typecheck      # tsc --noEmit
npm test               # Vitest, tests/ only
npm start              # the development loop
npm run start-packaged # build both bundles once, then electron-forge start
npm run build          # build-react + build-electron
npm run build-icons    # regenerate assets/icon.{icns,ico,png} from assets/icon.svg
npm run package        # package the application for the current platform
npm run make           # build the installers for the current platform
```

`npm run lint && npm run typecheck && npm test` is what has to pass before a change is done.

`npm run start-packaged`, `npm run package` and `npm run make` build the React renderer and the Electron bundles first, so Electron always loads local generated files. Regenerating the icons is a separate step, because their generated files are committed.

## 3.3 Two bundles, two bundlers

The renderer and the Electron sources are different targets, so they are built by different tools.

| | Renderer | Main and preload |
| --- | --- | --- |
| Tool | Vite | esbuild |
| Entry | `index.html` → `src/index.tsx` | `src/main/Main.ts`, `src/main/preload/Preload.ts` |
| Output | `build/` | `dist/electron/` |
| Target | `chrome150` — the renderer only ever runs in the Chromium Electron bundles, so nothing is downlevelled for other browsers | `node20`, CommonJS |
| Config | `vite.config.mts` | `scripts/electron-bundle.js` |

`package.json` points Electron at `dist/electron/main.js`. `electron` and `electron-log` are external to the esbuild bundle: they are resolved at runtime rather than bundled in.

**In-repository imports are absolute and never relative.** React sources import each other, and their own CSS, through `src/...` specifiers. `tsconfig.json` sets `baseUrl` to the repository root so TypeScript and ESLint resolve them, `vite.config.mts` declares the matching `src` alias so Vite and Vitest resolve them the same way at build and test time, and esbuild resolves them through `tsconfig.json`.

**Which section of `package.json` a dependency sits in decides whether it ships.** Electron Forge copies the `dependencies` into the packaged application and nothing else, so anything only the build or the tests need belongs in `devDependencies` — the Testing Library packages included: they are imported by `tests` alone, and leaving them in `dependencies` puts a test framework inside every build that never runs it. Dependency versions are exact, with no `^` or `~`.

## 3.4 The development loop

`npm start` runs `scripts/dev.js`, which is the loop to work in:

1. It starts a Vite development server through Vite's programmatic API and lets it pick its own port, so nothing has to agree on a port number in advance.
2. It passes the URL that server reported to Electron in the `SPOT_DEVELOPMENT_SERVER_URL` environment variable, named by `WINDOW_CONFIG.developmentServerUrlVariable`. `resolveWindowLoadTarget()` turns that into a `url` load target and `Main.ts` loads it with `loadURL()` instead of `loadFile()`. A renderer edit is then hot-reloaded by Vite in place, and React Fast Refresh keeps component state across it.
3. It builds the Electron main and preload bundles with a watching `esbuild` context and relaunches Electron after every successful rebuild. A rebuild that failed leaves the running application alone, because relaunching into a bundle that does not exist would only replace the error with a second one.
4. Electron is spawned directly from the `electron` package rather than through `electron-forge start`, so a relaunch costs no more than the process restart. Forge stays the entry point of `npm run start-packaged`, `npm run package` and `npm run make`, whose plugins all run at package time.

Closing the application stops the loop, and stopping the loop closes the application, the development server and the esbuild watcher.

Two consequences worth knowing:

- **A main-process relaunch kills the running process**, so the shutdown drain and the renderer flush handshake do not run: task changes still buffered in the renderer are lost ([§7.6](07-task-write-path.md#76-shutdown)). Renderer edits are unaffected, because they never restart the process.
- **The relaunch waits for the old process to be gone** before spawning the new one. It has to: the single instance lock in `Main.ts` would make the new process quit immediately otherwise.

`npm run start-packaged` is the other run: it builds everything once and starts the application from those files, so it shows what a packaged SPOT does but reflects no source change until it is started again. **It is not a development run** — it loads the built renderer, so it gets SPOT's own application menu and, on Windows, the menu bar SPOT draws itself ([§10](10-application-menu.md)).

## 3.5 The Content-Security-Policy, and why there are two

`index.html` ships a strict policy, and that is the policy the built page carries and the one a packaged run always uses.

A development server cannot satisfy it: React Fast Refresh installs its runtime through an inline module script, and the hot update channel is a WebSocket back to the server. The `spot-development-content-security-policy` plugin in `vite.config.mts` therefore rewrites the two policy meta tags **for the served page only**, allowing inline scripts and a WebSocket connection to the local server.

**The plugin throws if it finds no policy to rewrite**, so the two files cannot drift apart unnoticed. And a packaged run ignores the development server variable entirely, because honouring it there would let anything able to set an environment variable put a page of its own choosing behind the preload bridge ([§1.5](01-architecture.md#15-what-the-window-is-allowed-to-load)).

## 3.6 Packaging and application identity

`forge.config.js` describes the packaged application: `asar: true`, and the fuses plugin turns off `RunAsNode`, the `NODE_OPTIONS` variable and the CLI inspect arguments, turns on cookie encryption and ASAR integrity validation, and requires the application to load from the ASAR archive. `assets/`, `.vscode/`, `coverage/`, `out/` and `tests/` are excluded from the package; the icons are read from the repository at package time and do not need to be copied inside. That ignore pattern is anchored to the repository root, so it does not touch the `build/assets` renderer output, which must stay in the bundle.

**Three values name SPOT to the operating systems, and none of them has a usable default**: left unset, the packager falls back to Electron's own, which name the application after Electron and file it under developer tools.

- **`productName` in `package.json` is `SPOT`**, and it is the one the rest follows. The packager names the bundle and the executable after it, so the application is `SPOT.app` on macOS and `SPOT.exe` on Windows rather than the lowercase package name. Electron also answers `app.getName()` with it, and the user-data folder is named from that, so **changing `productName` moves the live database**: it is `Application Support/SPOT` and `%APPDATA%\SPOT` now, and a rename would leave the previous folder behind with every task in it. macOS and Windows both compare those names case-insensitively, so the change from `spot` to `SPOT` moved nothing on either, but a further change would.
- **`packagerConfig.appBundleId` is `io.github.simone3.spot`.** macOS keeps permissions, saved window state and launch services entries under the bundle identifier, so a new one reads as a different application and starts that history over. It should be treated as fixed once SPOT is installed anywhere. The `io.github` namespace is the repository hosting SPOT, which is the only reversed domain name unambiguously ours.
- **`packagerConfig.appCategoryType` is `public.app-category.productivity`**, which is what macOS files SPOT under.

**Four makers**, and each is told those names rather than left to infer them, because they infer from the lowercase package name and would then look for an executable that no longer has that name. `maker-squirrel` takes `SPOT`, `SPOT.exe` and `SPOT-Setup.exe`; `maker-zip` covers macOS; `maker-deb` and `maker-rpm` take the lowercase `spot` as the package name, which is the Linux convention, with `SPOT` as the product name and as the binary inside the package.

**Nothing is signed** beyond the ad-hoc signature the packager applies on macOS, which is trusted only on the machine that produced it — and which is also what lets the application run on Apple Silicon at all. A downloaded copy carries the quarantine attribute and Gatekeeper refuses it, reporting the application as damaged, until `xattr -dr com.apple.quarantine` is run on it, and Windows SmartScreen reports an unknown publisher. Getting past either properly needs a paid certificate — an Apple Developer Program one with notarization, or an Authenticode one — and SPOT buys neither. `README.md` tells the user what to do about both.

## 3.7 Icons

`assets/icon.svg` is the only hand-edited icon file: a rounded tile in an accent gradient carrying one translucent white ring, a solid white centre disc, and an accent checkmark inside that disc. Everything else is generated from it by `npm run build-icons`, which runs `scripts/build-icons.js` under Electron and rasterizes the master with Electron's own Chromium, so no image library or external converter is a dependency.

**The artwork is drawn for the smallest size it will ever be shown at**, not for the master canvas, and its earlier dark-tile form failed all four of these:

- A taskbar draws the icon at 16 pixels, so nothing may be thinner than roughly 8% of the 1024 canvas, which is the point below which a stroke averages into grey instead of resolving.
- Shapes are separated by colour rather than by opacity over the tile, because an accent laid on a dark tile at low alpha lands a fraction away from the tile itself and disappears.
- The ring, the gap and the disc are deliberately different widths, because evenly spaced concentric rings read as a moiré pattern rather than as a shape once they stop resolving.
- The tile carries the accent while the mark is white, rather than the other way around, because a near-black tile has no silhouette at all against a dark Windows taskbar: it must supply its own edge, since the platform gives it none.

The script produces two tiles from the same master, because the platforms disagree on framing: the macOS tile follows Apple's icon grid, an 824×824 body centered on a 1024×1024 transparent canvas, since macOS draws `.icns` artwork exactly as given and masks nothing, so a full-bleed tile would sit noticeably larger than every neighbouring dock icon; the full-bleed tile fills its canvas, which is what Windows and Linux expect since they scale and mask the artwork themselves.

From those it writes three committed files: `assets/icon.icns` for macOS, built by piping a full `.iconset` through the macOS `iconutil` command, `assets/icon.ico` for Windows, packed directly as an ICO container of PNG entries from 16 to 256 pixels, and `assets/icon.png` at 512 pixels for Linux. Because `iconutil` only exists on macOS, a run on another platform skips the `.icns` file and keeps the other two.

**Two details of the render are deliberate and easy to break.** The window uses a fully transparent `backgroundColor` rather than a `transparent` window, because a transparent window needs a real display and fails when the build runs headless. Both tiles are laid out side by side in one page and taken in a single capture, then cropped apart, because a window reliably serves only one load and one capture: a second load, or a second window, fails once the first capture is done. The capture comes back at the display's device scale factor, so the script accepts anything at or above the canvas size and derives every icon size from it by resizing down.

`forge.config.js` points `packagerConfig.icon` at the extension-less `assets/icon` path and lets the packager choose `.icns` or `.ico` per platform, while `maker-squirrel` takes `icon.ico` as its `setupIcon` and `maker-deb` and `maker-rpm` take `icon.png`.

## 3.8 Releasing

A release is one `v<version>` tag, and `.github/workflows/release.yml` is what turns it into downloadable installers.

**The installers cannot all be built on one machine.** The Squirrel installer needs Windows, and the Debian and RPM packages need the packaging tools of a Linux distribution, so `npm run make` on a development machine only ever produces the installers of that machine's own platform. The workflow runs it once per operating system instead, on a `macos-latest`, a `windows-latest` and an `ubuntu-latest` runner, which is what makes a release covering all three possible at all. The Linux runner installs `fakeroot` and `rpm` first, because its image carries neither and the two makers shell out to them.

Every runner also runs `npm run lint`, `npm run typecheck` and `npm test` before packaging, so a release is never built out of a tree that does not pass the checks. **That is also what makes the `package.json` scripts cross-platform code**: npm runs them through `cmd.exe` on Windows, which strips double quotes but leaves single ones in the argument, so the glob patterns of the lint script are double-quoted. Single quotes would reach ESLint as part of the pattern and match nothing.

Only the files a user downloads are kept as artifacts: the `.zip`, the `.exe`, the `.deb` and the `.rpm`. The Squirrel update files the maker writes next to the installer are of no use without an update server to serve them from.

A last job downloads all of that and creates the GitHub release with `gh release create` and the runner's own `GITHUB_TOKEN`. **The release is a draft**, and publishing it is a manual step: the generated notes are worth reading before anybody can download anything. A run started by hand instead of by a tag builds and uploads the installers but creates no release, which is how the workflow is tested without cutting a tag first.

**The version is raised in the commit the tag is put on.** The `version` field of `package.json` is what the installers carry and what `AppInfoSettings` shows the user, and nothing checks that the tag and the field agree.

---

[← §2 Repository map](02-repository-map.md) · [§4 Framework layer →](04-framework.md)
