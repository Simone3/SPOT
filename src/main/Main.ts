import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { registerTaskStorageIpcHandlers, resolveSpotStorageDirectory } from 'src/main/ipc/TaskStorageIpc';
import { initializeSpotLogger } from 'src/main/logging/SpotLogger';
import { resolveWindowLoadTarget } from 'src/main/window/WindowLoadTarget';

const PRELOAD_SCRIPT_FILE_NAME = 'preload.js';

const createWindow = (): void => {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, PRELOAD_SCRIPT_FILE_NAME)
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
