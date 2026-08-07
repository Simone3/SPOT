import type { App, IpcMain } from 'electron';
import type { SpotAppInfo } from 'src/types/AppInfoTypes';
import { SPOT_APP_INFO_IPC_CHANNELS } from 'src/types/AppInfoIpcChannels';

export { SPOT_APP_INFO_IPC_CHANNELS } from 'src/types/AppInfoIpcChannels';

type AppInfoIpcMain = Pick<IpcMain, 'handle'>;

type AppInfoApp = Pick<App, 'getVersion'>;

export interface RegisterAppInfoIpcHandlersOptions {
	ipcMain: AppInfoIpcMain;
	app: AppInfoApp;
}

// Answers the renderer's question of which build it is part of. The version is read from Electron rather than from "package.json"
// directly, so that it is the one the running application actually reports, whether it was started from the repository or from an
// installed copy, and it is read again on every request rather than captured once.
export const registerAppInfoIpcHandlers = ({ ipcMain, app }: RegisterAppInfoIpcHandlersOptions): void => {
	ipcMain.handle(SPOT_APP_INFO_IPC_CHANNELS.getAppInfo, (): SpotAppInfo => {
		return {
			version: app.getVersion()
		};
	});
};
