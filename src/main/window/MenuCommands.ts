import type { App, BrowserWindow, WebContents } from 'electron';
import { ZOOM_CONFIG } from 'src/config/AppConfig';
import { SPOT_MENU_COMMANDS, type SpotMenuCommand } from 'src/types/AppMenuTypes';

/**
 * What the entries of the menu bar SPOT draws itself actually do.
 *
 * The native menu answers its own entries, because every one of them is an Electron role. A drawn entry has no role behind it, so the
 * behaviour it stands for is written here instead, and each one does what the role of the same name does. This is also the whole of
 * what the renderer is allowed to ask the main process to do: an unknown command name is ignored rather than guessed at, so the menu
 * bridge cannot become a way of reaching anything else.
 */

// What a command needs of Electron: the application, for the one entry that ends it, and the window the menu belongs to
export interface SpotMenuCommandTarget {
	app: Pick<App, 'quit'>;

	// Read again on every command rather than captured: the window can be closed and, on macOS, created again while the process lives
	getWindow: () => BrowserWindow | undefined;
}

// Chromium keeps zoom as a level rather than a factor, where every level is 1.2 times the previous one and 0 is the normal size
const zoomBy = (webContents: WebContents, steps: number): void => {
	const wantedLevel = webContents.getZoomLevel() + steps * ZOOM_CONFIG.stepLevel;

	webContents.setZoomLevel(Math.min(Math.max(wantedLevel, ZOOM_CONFIG.minimumLevel), ZOOM_CONFIG.maximumLevel));
};

// Keyed by command name, so an unknown one finds nothing to run instead of falling into a default case that does something
const COMMAND_HANDLERS: Record<SpotMenuCommand, (window: BrowserWindow, target: SpotMenuCommandTarget) => void> = {
	[SPOT_MENU_COMMANDS.exit]: (_window, target) => {
		target.app.quit();
	},
	[SPOT_MENU_COMMANDS.undo]: (window) => {
		window.webContents.undo();
	},
	[SPOT_MENU_COMMANDS.redo]: (window) => {
		window.webContents.redo();
	},
	[SPOT_MENU_COMMANDS.cut]: (window) => {
		window.webContents.cut();
	},
	[SPOT_MENU_COMMANDS.copy]: (window) => {
		window.webContents.copy();
	},
	[SPOT_MENU_COMMANDS.paste]: (window) => {
		window.webContents.paste();
	},
	[SPOT_MENU_COMMANDS.selectAll]: (window) => {
		window.webContents.selectAll();
	},
	[SPOT_MENU_COMMANDS.resetZoom]: (window) => {
		window.webContents.setZoomLevel(0);
	},
	[SPOT_MENU_COMMANDS.zoomIn]: (window) => {
		zoomBy(window.webContents, 1);
	},
	[SPOT_MENU_COMMANDS.zoomOut]: (window) => {
		zoomBy(window.webContents, -1);
	},
	[SPOT_MENU_COMMANDS.toggleFullScreen]: (window) => {
		window.setFullScreen(!window.isFullScreen());
	},
	[SPOT_MENU_COMMANDS.minimize]: (window) => {
		window.minimize();
	},
	[SPOT_MENU_COMMANDS.close]: (window) => {
		// The close is the one the user asks for through the window button as well, so it goes through the same handler and saves
		// whatever the renderer still buffers
		window.close();
	}
};

/**
 * Runs one entry of the menu bar SPOT draws.
 * @param command What the entry stands for. Anything that is not one of the known commands does nothing.
 * @param target The application and the window to run it against.
 */
export const runSpotMenuCommand = (command: string, target: SpotMenuCommandTarget): void => {
	const handler = COMMAND_HANDLERS[command as SpotMenuCommand] as typeof COMMAND_HANDLERS[SpotMenuCommand] | undefined;

	if(!handler) {
		return;
	}

	const window = target.getWindow();

	// A menu clicked while the window is going away has nothing left to act on, and the application command needs one just as much:
	// quitting is what the window close already does
	if(!window || window.isDestroyed()) {
		return;
	}

	handler(window, target);
};
