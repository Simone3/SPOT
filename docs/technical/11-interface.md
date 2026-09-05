# §11 — The interface

*[Index](README.md) · [← §10 The application menu](10-application-menu.md)*

Where the tree that holds all of this is described: [§1.3](01-architecture.md#13-the-renderer-tree). What it is drawn with: [§12](12-styling.md).

---

## 11.1 The page layout

The page is a fixed-height flex application:

- `#root` is a vertical flex container.
- `TitleBar` is the first row where there is one, and takes no room at all where there is not ([§10.3](10-application-menu.md#103-the-renderer-half)).
- `#app-body` is the horizontal flex container filling what is left of the window.
- `Sidebar` stays on the side.
- `MainContent` renders the selected route.
- `Page` and `Pane` build the page-level split layout.
- `ResizablePanes` and `PaneDivider` make a two-pane page resizable ([§11.5](#115-resizable-panes)).

## 11.2 The task page

`TasksPage` reads `TasksContext` and renders a filter pane, an active tasks list, and a completed tasks list when `showCompleted` is enabled.

The filter pane and the task lists are the two panes of a `ResizablePanes` split, so the user can give the filters as much or as little width as they want, down to the width their own heading needs. **The loading and startup-error states stay a plain single-pane `Page`**: there are no filters to resize yet.

`TasksList`:

- filters the list down to tasks where `visible` is true
- renders list header actions for active tasks: refresh visible tasks, sort active tasks by importance, add task
- supports drag-and-drop reordering through `@dnd-kit/react`
- maps visible drag indices back to original task indices before moving tasks

`Task`:

- **owns no buffering state of its own**: it renders the task from the state merged with the buffered changes held by `src/logic/PendingTaskChanges.ts`, and subscribes to them through `useSyncExternalStore` ([§7.3](07-task-write-path.md#73-buffered-task-changes))
- **has no timers and no lifecycle effects**, so what the user typed cannot outlive or drift away from the component that shows it
- writes every edit into the buffer, and asks for an immediate save on blur and when a picker closes
- fades out for 3 seconds before the buffered state change from the completion checkbox is saved; while fading, other task controls are disabled, and changing the checkbox back before the fade completes cancels the state change and restores full opacity
- owns the generic task value setter and passes field-specific setters to the task chips
- renders priority, text, owner, due date, tags, and a vertical action column with drag, completion and delete controls

`TaskActions` toggles between active and completed state and opens a confirmation modal before deleting.

`TaskChips`:

- receives dedicated owner, due date and tags setters from `Task`
- **owns the id of every chip input** and hands it to both the input and its `Chip`, so that the chip icon is a real `<label>` for the input and clicking the icon focuses it. `FreeSelectInput` and `DatePicker` fall back to an id of their own when the caller does not give them one
- edits the owner through `FreeSelectInput`, the due date through `DatePicker`, and every tag through `FreeSelectInput`, all of them the same way
- renders one tag input per task tag, **plus a trailing empty one** for the next tag whenever the last task tag is not empty already. The trailing input is derived at render time, so it is always there without the task tags having to carry it
- turns what the user types into the trailing input into a task tag right away, which is why a new empty input appears next to it as soon as they start typing
- removes a tag emptied by the user when they leave its input, wherever it is in the list. An empty tag is never persisted either, so a tag input the user has not filled in yet costs nothing
- trims owner and tag values on finish, and reuses existing capitalization when the typed value matches an existing domain case-insensitively

`TaskPriority` displays the selected priority icon and color bar, opens a priority picker on click, and flushes changes when the picker closes.

## 11.3 Settings

`SettingsPage` renders `BackupSettings` from `src/components/storage` and `AppInfoSettings` from `src/components/settings`. **The backup section is written to make the persistence model obvious to the user**, because the two folders it names mean very different things:

- **The task database section** states that the tasks live in a single `spot.sqlite` file inside the SPOT application folder, that this is always where they are read from and written to, and that it cannot be moved. It shows the full database path.
- **The backup folder section** states that SPOT never reads these copies back and does not keep two computers in sync, and then how to restore one by hand, since nothing in SPOT will: close SPOT, copy the backup you want over the database above under that exact name. **The restore instructions sit in that same paragraph** rather than in a section of their own, because restoring is the other half of what it already says about copies never being read back.
- **The copies-to-keep section** holds the number itself and, beside it, **what that number actually gets the user**, in words: nothing at all, one backup kept a couple of minutes behind the changes, or that one and however many dated ones are left over. A bare number says none of that.

It also shows the current backup folder, a development-run notice when the run is not packaged, the reason a saved folder could not be used, and **both backup outcomes separately** — when the up-to-date copy was last written, and when the newest dated copy was — since a folder that is current but has not reached back in days is a different thing to know than one that is neither.

Two actions change the folder: *Change folder*, which opens the native folder dialog, and *Use default folder*, which selects the default folder of the current run. **Both open a `ConfirmModal`** that names the current folder, the new folder, and states that the copies already written stay where they are and that the tasks are not moved. The change is applied only after confirmation, and its outcome is reported in place. **The number of copies has no confirmation** and is applied when the field is left or Enter is pressed: nothing is deleted by changing it, so there is nothing to confirm. The field holds what is being typed rather than the applied count, so a half-entered number is neither thrown away nor applied, and it goes back to showing the applied count once the change lands — which is also how a count held to its range shows up ([§6.5](06-persistence.md#65-choosing-the-backup-folder-and-the-number-of-copies)).

`AppInfoSettings` closes the page with the version the running application reports, which is the only thing that tells two installed copies apart. It asks the main process once when it mounts, and says the version is unknown rather than showing an empty line when there is no answer, since a missing version is never worth a warning.

## 11.4 Common components

Common components: `TitleBar`, `MenuBar`, `Sidebar`, `SidebarElement`, `MainContent`, `Page`, `Pane`, `ResizablePanes`, `PaneDivider`, `Header`, `Clickable`, `Chip`, `ConfirmModal`, `Tooltipped`.

Input components: `Button`, `ButtonsSelect`, `Checkbox`, `DatePicker`, `FreeSelectInput`, `TextArea`, `TextInput`. Icons are local React components under `src/components/icons`.

`ButtonsSelect` and `FreeSelectInput` are string-valued input components. **They accept simple option objects instead of app-specific domain types.**

`FreeSelectInput` is a text input with a suggestion dropdown, and shows the options in the order the caller gives them:

- **The dropdown exists only while it is open.** The options are neither computed nor rendered otherwise, which matters because a task list renders one of these inputs per owner and per tag of every visible task, and only one of them can be open at a time.
- Every option is shown until the user types, after which the list keeps the options whose label contains what was typed, case-insensitively, minus the one that is already exactly it.
- A filtered option shows the typed part as it is and the rest of the label in bold, so what picking it would add is what stands out. The match can start anywhere in the label, so a label can have a bold part on either side of it.

`TitleBar` is the row that replaces the title bar the operating system would draw, and `MenuBar` is the menu inside it. **It behaves like the menu bar it replaces**: a submenu opens on the first click and every other one then opens by being pointed at, the arrow keys walk both the titles and the entries, Enter picks one, and Escape or a click anywhere else closes it.

**What it deliberately does not do is take the focus.** The Edit entries act on whatever the user was typing in, and a menu that moved the focus onto itself would be a menu that took the selection away from that field before acting on it, so both the titles and the entries cancel the focus the pointer would give them, and the entry the keyboard is on is a highlight `MenuBar` holds rather than the focused element. The keys are read from a `document` listener in the capture phase for the same reason: the field still has the focus while the menu is open, and an arrow key that reached it would move the caret behind the menu. The bar is still reachable by keyboard, because the submenu titles are ordinary focusable buttons, and they are the only part of it that draws the shared focus ring; an entry never has the focus to draw one with.

`Clickable` makes anything the caller renders clickable, and carries no look of its own beyond the pointer, the disabled state and the shared focus ring. It renders a `button` and takes an optional label, which is what names a control that is only an icon, such as the task delete action. The header actions are named by the label they already show, so they pass none.

`TextArea` is the field a task's text is written in, and it is **a plain controlled `textarea` holding plain text**. It was a Markdown editor (`MDXEditor`) until the format turned out to be the wrong one for the job: Markdown has no way to write two blank lines in a row, so every value that went back into the editor came back with them collapsed into a single paragraph break, and a task could not be spaced out the way the user had typed it. Plain text carries whatever was typed, and it is also what the content filter already searched ([§9.3](09-tasks.md#93-filtering)). A rich task text would need a format that survives being read back, not a rich editor over one that does not.

**The field is as tall as what it holds**, through the CSS `field-sizing: content` rather than through a measured height in JavaScript, so a task grows as it is written instead of scrolling inside a box of its own. Chromium is what sizes it and is the only engine SPOT runs on; anywhere else the field stays the single row the element asks for. It is `disabled` while the task is fading out of the list, like every other control on the card; the colors it is given are author styles, so the browser's own disabled look never reaches it.

## 11.5 Resizable panes

`ResizablePanes` renders a two-pane page whose divider the user can drag, between the widths the two panes need. The task page uses it for the filters pane and the tasks pane; every other page still renders a plain `Page` with a single `Pane`. **Neither pane collapses**: the divider simply stops where a pane would stop showing what it holds, so nothing on screen ever has to be brought back.

**The split is held as the share of the width the two panes have between them**, meaning the container width without the divider, and never as a pixel width:

- Both panes are laid out with that share as their flex grow value, and the two shares always add up to one, so nothing has to be measured to render the page and resizing the window keeps the proportion the user chose.
- The two panes are exactly what the divider leaves of the page, so the width they share is measured as the sum of their own widths and the divider needs no container measurement of its own.
- `.pane` sets `min-width: 0`, because a flex item otherwise refuses to shrink below its content and the layout, not the content, is what decides how narrow a pane may get.
- `PaneDivider` draws the line that `.pane` would otherwise draw as its left border, and is wider than that line so it can be grabbed without aiming at two pixels.

**How narrow a pane may get is not a constant**: it is measured from the headers the pane holds, because a heading whose labels have to newline is where a pane stops being readable. `ResizablePanes` finds them by the `HEADER_LINE_CLASS_NAME` that `Header` renders, and measures what each one needs as what its own children need side by side, plus their margins. The children are measured rather than the header itself because a header in a wide pane would only report the width of that pane back, and one in a narrow pane has already clipped what did not fit. This is also why `.header-title` and `.header-action-label` are `white-space: nowrap`: it makes the measured width the width the header needs on one line, and it keeps a squeezed header from stacking its labels instead of pushing back. The title carries the same right margin as the gap between the actions, through the `--header-actions-gap` variable the header line declares, so the measured width includes that spacing and a header at its narrowest never has its title touching the first action. A pane that holds no header falls back to `PANE_LAYOUT_CONFIG.minimumPaneWidthPixels`, which is also the floor for a pane whose headers need less than that.

`clampPaneFraction()` in `src/logic/PaneLayout.ts` decides what a share is allowed to be from those measurements: neither pane is ever dragged below the width it needs, so the divider stops instead of collapsing anything. **The wanted width is rounded to whole pixels first**, because a share carried back and forth through a share of a width would otherwise land a fraction of a pixel outside a limit and move a pane the user dragged exactly onto it. A page too narrow to hold both panes at once has no allowed width left to pick, and the width there is then goes to the second pane, which is where the user is working; the first pane gets its own width back as soon as the window is wide enough again.

**The limits are widths while the split is a proportion**, so a window that just became narrower can leave the panes on a split that is not allowed anymore. `ResizablePanes` therefore clamps the current share again on the window `resize` event. Clamping is idempotent and an unchanged share notifies nobody, so that cannot loop.

The divider is a focusable `separator`: the arrow keys move it by `PANE_LAYOUT_CONFIG.keyboardStepFraction`, `Home` and `End` take the first pane as narrow and as wide as it goes, and a double click restores the default split. Dragging it puts a class on the body, because the pointer is over the panes for the whole drag and both the resize cursor and the block on text selection have to hold for the whole window.

**`src/logic/PaneLayout.ts` holds the share of each split layout outside the component tree**, keyed by a layout ID, the way `PendingTaskChanges.ts` holds buffered task edits: leaving the page unmounts it, and the user's layout must survive that just like the task state does. It is session state on purpose. Nothing is written to disk, so every SPOT start opens on the default split, which is the one third the filters pane has always taken.

---

[← §10 The application menu](10-application-menu.md) · [§12 Styling →](12-styling.md)
