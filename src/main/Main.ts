import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { WINDOW_CONFIG } from 'src/config/AppConfig';
import { registerTaskStorageIpcHandlers, resolveSpotStorageDirectory } from 'src/main/ipc/TaskStorageIpc';
import { initializeSpotLogger } from 'src/main/logging/SpotLogger';
import { resolveWindowLoadTarget } from 'src/main/window/WindowLoadTarget';

const createWindow = (): void => {
	const win = new BrowserWindow({
		width: WINDOW_CONFIG.widthPixels,
		height: WINDOW_CONFIG.heightPixels,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, WINDOW_CONFIG.preloadScriptFileName)
		}
	});

	const loadTarget = resolveWindowLoadTarget({
		appRootDirectory: app.getAppPath()
	});

	void win.loadFile(loadTarget.value);
};

void app.whenReady().then(() => {
	initializeSpotLogger({
		storageDirectory: resolveSpotStorageDirectory(app)
	});

	ipcMain.handle('ping', () => {
		return 'pong';
	});
	registerTaskStorageIpcHandlers({
		app,
		ipcMain
	});

	createWindow();

	app.on('activate', () => {
		if(BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if(process.platform !== 'darwin') {
		app.quit();
	}
});
