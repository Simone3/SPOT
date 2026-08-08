/**
 * The menu bar SPOT draws itself, on the platforms where the native one cannot be made to look like the rest of the application.
 *
 * The description travels from the main process to the renderer, and what the renderer sends back is only ever one of the command
 * names below: the menu is data on the way out and a closed set of commands on the way in, so nothing in the window can ask the main
 * process for anything the menu does not already offer.
 */

// What a menu entry does. The main process owns the behaviour of each one, the same way an Electron role owns the behaviour it brings.
export const SPOT_MENU_COMMANDS = {
	exit: 'exit',
	undo: 'undo',
	redo: 'redo',
	cut: 'cut',
	copy: 'copy',
	paste: 'paste',
	selectAll: 'select-all',
	resetZoom: 'reset-zoom',
	zoomIn: 'zoom-in',
	zoomOut: 'zoom-out',
	toggleFullScreen: 'toggle-full-screen',
	minimize: 'minimize',
	close: 'close'
} as const;

export type SpotMenuCommand = typeof SPOT_MENU_COMMANDS[keyof typeof SPOT_MENU_COMMANDS];

export interface SpotMenuEntry {

	type: 'entry';
	command: SpotMenuCommand;
	label: string;

	// What the entry shows on its right, as the accelerator of the matching item of the hidden native menu is written. The native menu
	// is what actually answers the keystroke, so this is the one place where the two have to be kept saying the same thing.
	accelerator?: string;
}

export interface SpotMenuSeparator {
	type: 'separator';
}

export type SpotMenuItem = SpotMenuEntry | SpotMenuSeparator;

export interface SpotMenu {

	// Identifies the submenu for the renderer, which needs a key that survives a translated label
	id: string;
	label: string;
	items: SpotMenuItem[];
}

export interface SpotAppMenuApi {

	// Empty on every platform and every run that keeps a native menu bar, which is what tells the renderer to draw nothing at all
	getMenuBar: () => Promise<SpotMenu[]>;

	runMenuCommand: (command: SpotMenuCommand) => Promise<void>;
}
