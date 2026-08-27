# §10 — The application menu

*[Index](README.md) · [← §9 Tasks](09-tasks.md)*

---

## 10.1 The native menu

`src/main/window/AppMenu.ts` builds the native menu, and `Main.ts` installs it before the window exists. **It replaces the menu Electron installs when nobody asks**, which carries reload, force reload and the developer tools: those belong to a development run, not to an installed application where reloading discards whatever the renderer still buffers.

**A development run therefore keeps that default menu**, and `installSpotApplicationMenu()` returns without touching anything. Which run is which comes from `isDevelopmentRun()` in `src/main/window/WindowLoadTarget.ts`, read from the resolved load target rather than from the environment a second time, so the one place that refuses the development server variable in a packaged run decides the menu too ([§1.5](01-architecture.md#15-what-the-window-is-allowed-to-load)). `npm run start-packaged` is not a development run: it loads the built renderer and gets SPOT's menu, which is what makes it show what a packaged SPOT does.

The menu is:

- the application submenu (`appMenu`) on macOS, which is where About, Hide and Quit live there, and a File submenu holding Quit on the other platforms, which is where they expect it
- Edit (`editMenu`)
- View, holding the zoom roles and full screen
- Window (`windowMenu`)

**The Edit submenu is not decoration.** On macOS the standard editing shortcuts are the accelerators of those menu items, so installing a menu without it takes copy and paste away from every task input in the window. Any future change to this menu keeps it.

**Every entry but the two submenu titles is an Electron role** rather than a command of SPOT's own, so it brings its own label, accelerator and behaviour, worded by Electron in the language the operating system runs in. Only `menu.file` and `menu.view` are needed from the translation bundle for it, because those two submenus have no role to take a title from. The rest of the `menu` keys word the bar SPOT draws itself, where nothing is worded for it.

## 10.2 The menu bar SPOT draws itself

The native menu is what the user sees on macOS, where it lives in the system menu bar at the top of the screen and looks like every other application's. **On Windows it is drawn by the operating system as a grey strip under the title bar, above a window that is dark**, and nothing in Electron restyles it: it is not a web view, and `BrowserWindow` offers no colors for it. SPOT therefore hides it there and draws the menu bar itself, in the colors of the application, the way Visual Studio Code does.

`drawsOwnMenuBar()` in `src/main/window/AppMenu.ts` is the one place that decides which it is: **Windows, and not a development run.** A development run keeps everything Electron gives it, menu bar included, because that is where the reload and developer tools entries have to stay reachable — so `npm run start-packaged` is the way to see the drawn one on Windows. **Linux is deliberately left alone**: hiding the menu bar there means taking over the window buttons as well, and its desktop environments draw those in ways SPOT would only approximate.

Three things follow from that decision, and `Main.ts` applies all three before the window is on screen:

- **The window is created with `titleBarStyle: 'hidden'` and a `titleBarOverlay`**, which is what makes room for a bar of SPOT's own. Electron keeps drawing the real minimize, maximize and close buttons over the right of that row, so those stay the operating system's, snap layouts included; the two colors they are drawn in come from `TITLE_BAR_CONFIG` and mirror the renderer theme.
- **`setMenuBarVisibility(false)`** turns the native bar off, because Electron draws it inside the window once the title bar is hidden and it would otherwise sit there as a second, unstyled menu.
- **The native menu itself stays installed.** It is what answers the keyboard: the accelerators belong to its roles, so hiding the bar keeps every shortcut working and the drawn bar only has to say what they are.

The drawn bar is a separate description, built by `buildSpotDrawnMenuBar()` and sent to the renderer through `window.spotAppMenu`. It holds the same four submenus, in the wording of the translation bundle, and **each entry names a command from `SPOT_MENU_COMMANDS` instead of an Electron role**. `src/main/window/MenuCommands.ts` is what those commands do, and each one does what the role of the same name does: the editing commands act on the window's `webContents`, the zoom commands move the Chromium zoom level by `ZOOM_CONFIG.stepLevel` between its two limits, and the rest minimize, close, toggle full screen or quit. **Anything that is not one of those command names is ignored rather than guessed at**, so the bridge is a closed set and not a way of reaching whatever the main process can do.

**Two definitions of one menu is a real cost, and it buys the accelerators**: keeping the native menu as roles means Electron owns what each shortcut listens for and what it does, on every platform, and the drawn bar never has to reimplement that. What it does have to repeat is the shortcut *text*, which is display only, so an entry changed on one side has to be changed on the other.

## 10.3 The renderer half

`TitleBar` and `MenuBar` under `src/components/common` are the renderer side, reached through `src/logic/AppMenu.ts`, which is the only module that touches `window.spotAppMenu`. **`TitleBar` asks for the menu once when it mounts and renders nothing at all when the answer is empty**, which is what every platform that keeps its native menu bar answers, so the window there is exactly the window it has always been.

[§1.3](01-architecture.md#13-the-renderer-tree) places it in the tree and [§11.4](11-interface.md#114-common-components) describes how the bar behaves — in particular why it never takes the focus.

---

[← §9 Tasks](09-tasks.md) · [§11 The interface →](11-interface.md)
