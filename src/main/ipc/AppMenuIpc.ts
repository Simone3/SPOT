import type { IpcMain } from 'electron';
import { runSpotMenuCommand, type SpotMenuCommandTarget } from 'src/main/window/MenuCommands';
import { SPOT_APP_MENU_IPC_CHANNELS } from 'src/types/AppMenuIpcChannels';
import type { SpotMenu } from 'src/types/AppMenuTypes';

export { SPOT_APP_MENU_IPC_CHANNELS } from 'src/types/AppMenuIpcChannels';

type AppMenuIpcMain = Pick<IpcMain, 'handle'>;

export interface RegisterAppMenuIpcHandlersOptions {
	ipcMain: AppMenuIpcMain;

	// What the renderer draws, or nothing at all on a platform that keeps its native menu bar. The main process decides which it is,
	// because it is the side that knows the platform and whether the native menu was hidden.
	menuBar: SpotMenu[];

	commandTarget: SpotMenuCommandTarget;
}

// The two halves of the menu bar SPOT draws itself: what it says, which the main process owns because it owns the menu, and what
// happens when an entry is picked, which stays in the main process because a menu entry acts on the window and not on the page.
export const registerAppMenuIpcHandlers = ({ ipcMain, menuBar, commandTarget }: RegisterAppMenuIpcHandlersOptions): void => {
	ipcMain.handle(SPOT_APP_MENU_IPC_CHANNELS.getMenuBar, (): SpotMenu[] => {
		return menuBar;
	});

	ipcMain.handle(SPOT_APP_MENU_IPC_CHANNELS.runMenuCommand, (_event, command: unknown): void => {
		// Nothing but a known command name is acted on, and an unknown one is not an error worth reporting: it can only come from a
		// renderer asking for something this menu does not offer
		if(typeof command === 'string') {
			runSpotMenuCommand(command, commandTarget);
		}
	});
};
