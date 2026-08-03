import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { WINDOW_CONFIG } from 'src/config/AppConfig';
import { createDatabaseLocationManager } from 'src/main/config/DatabaseLocationManager';
import { resolveSpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { registerDatabaseLocationIpcHandlers } from 'src/main/ipc/DatabaseLocationIpc';
import { registerTaskStorageIpcHandlers } from 'src/main/ipc/TaskStorageIpc';
import { initializeSpotLogger } from 'src/main/logging/SpotLogger';
import { createTaskStorage } from 'src/main/storage/TaskStorage';
import { resolveWindowLoadTarget } from 'src/main/window/WindowLoadTarget';

let mainWindow: BrowserWindow | undefined;

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

	mainWindow = win;
	win.on('closed', () => {
		if(mainWindow === win) {
			mainWindow = undefined;
		}
	});

	void win.loadFile(loadTarget.value);
};

void app.whenReady().then(async() => {
	const runtimePaths = resolveSpotRuntimePaths(app);

	initializeSpotLogger({
		logDirectory: runtimePaths.logDirectory
	});

	const taskStorage = createTaskStorage();

	ipcMain.handle('ping', () => {
		return 'pong';
	});

	const { runExclusively } = registerTaskStorageIpcHandlers({
		app,
		ipcMain,
		taskStorage,
		getRendererFlushTarget: () => {
			return mainWindow?.webContents;
		}
	});
	const databaseLocationManager = createDatabaseLocationManager({
		runtimePaths,
		taskStorage,
		runExclusively
	});

	registerDatabaseLocationIpcHandlers({
		ipcMain,
		dialog,
		databaseLocationManager,
		getParentWindow: () => {
			return mainWindow;
		}
	});

	await databaseLocationManager.initialize();

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
