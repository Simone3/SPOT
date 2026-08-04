import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { WINDOW_CONFIG } from 'src/config/AppConfig';
import { createBackupLocationManager } from 'src/main/config/BackupLocationManager';
import { resolveSpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { registerBackupLocationIpcHandlers } from 'src/main/ipc/BackupLocationIpc';
import { registerTaskStorageIpcHandlers } from 'src/main/ipc/TaskStorageIpc';
import { initializeSpotLogger } from 'src/main/logging/SpotLogger';
import { createBackupScheduler, type BackupScheduler } from 'src/main/storage/BackupScheduler';
import { createTaskStorage } from 'src/main/storage/TaskStorage';
import { resolveWindowLoadTarget } from 'src/main/window/WindowLoadTarget';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';
import type { BackupStatus } from 'src/types/TaskStorageTypes';

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

	const taskStorage = createTaskStorage({
		databaseDirectory: runtimePaths.databaseDirectory,
		backupDirectory: runtimePaths.defaultBackupDirectory
	});

	ipcMain.handle('ping', () => {
		return 'pong';
	});

	// The scheduler needs the storage chain that registering the handlers returns, and the handlers need the scheduler to start and finish backups
	let backupScheduler: BackupScheduler | undefined;

	const { runExclusively } = registerTaskStorageIpcHandlers({
		app,
		ipcMain,
		taskStorage,
		getRendererFlushTarget: () => {
			return mainWindow?.webContents;
		},
		onTaskCommandApplied: () => {
			backupScheduler?.notifyTasksChanged();
		},
		onBeforeStorageShutdown: () => {
			return backupScheduler?.runFinalBackup() ?? Promise.resolve();
		}
	});

	backupScheduler = createBackupScheduler({
		taskStorage,
		runExclusively,
		onBackupStatusChanged: (status: BackupStatus) => {
			if(mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.webContents.send(SPOT_STORAGE_IPC_CHANNELS.backupStatusChanged, status);
			}
		}
	});

	const backupLocationManager = createBackupLocationManager({
		runtimePaths,
		taskStorage,
		runExclusively,
		onBackupDirectoryChanged: () => {
			backupScheduler?.notifyTasksChanged();
		}
	});

	registerBackupLocationIpcHandlers({
		ipcMain,
		dialog,
		backupLocationManager,
		getParentWindow: () => {
			return mainWindow;
		}
	});

	await backupLocationManager.initialize();

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
