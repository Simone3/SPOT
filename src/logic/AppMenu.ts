import type { SpotAppMenuApi, SpotMenu, SpotMenuCommand } from 'src/types/AppMenuTypes';

/**
 * The renderer side of the menu bar SPOT draws itself.
 *
 * This is the only module that touches "window.spotAppMenu", the way "Diagnostics.ts" is the only one that touches the diagnostics
 * bridge. Nothing here is a failure worth reporting: a menu that could not be read is a window without one, which is exactly what
 * every platform that keeps its native menu bar gets, and a command that could not be sent is a click that did nothing.
 */

// The bridge is only there behind the preload script: the renderer is typed as if it always were, so this is where that is checked
const getAppMenuApi = (): SpotAppMenuApi | undefined => {
	const appMenuApi = window.spotAppMenu as SpotAppMenuApi | undefined;

	return appMenuApi;
};

/**
 * Asks the main process what the drawn menu bar holds.
 * @returns The submenus to draw, and none at all when this platform and this run keep a native menu bar.
 */
export const loadDrawnMenuBar = async(): Promise<SpotMenu[]> => {
	const appMenuApi = getAppMenuApi();

	if(!appMenuApi) {
		return [];
	}

	try {
		return await appMenuApi.getMenuBar();
	}
	catch {
		return [];
	}
};

/**
 * Runs what a menu entry stands for, which the main process owns because it acts on the window and not on the page.
 * @param command The command of the entry the user picked.
 */
export const runMenuCommand = (command: SpotMenuCommand): void => {
	const appMenuApi = getAppMenuApi();

	if(!appMenuApi) {
		return;
	}

	void appMenuApi.runMenuCommand(command).catch(() => {
		return undefined;
	});
};
