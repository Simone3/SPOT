import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { BACKUP_CONFIG, LOGGING_CONFIG, WINDOW_CONFIG } from 'src/config/AppConfig';
import { createBackupLocationManager } from 'src/framework/main/config/BackupLocationManager';
import { initializeAppLogger } from 'src/framework/main/logging/AppLogger';
import { createBackupScheduler, type BackupScheduler } from 'src/framework/main/storage/BackupScheduler';
import type { BackupStatus } from 'src/framework/types/StorageTypes';
import { createSpotBackupDirectoryStore, createSpotConfigStore } from 'src/main/config/SpotConfigStore';
import { resolveSpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { registerBackupLocationIpcHandlers } from 'src/main/ipc/BackupLocationIpc';
import { registerTaskStorageIpcHandlers } from 'src/main/ipc/TaskStorageIpc';
import { createTaskStorage } from 'src/main/storage/TaskStorage';
import { resolveWindowLoadTarget } from 'src/main/window/WindowLoadTarget';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';

let mainWindow: BrowserWindow | undefined;

// "requestRendererFlushBeforeWindowClose" saves the task changes the renderer still buffers, or returns undefined when the window can close right away
interface CreateWindowOptions {
	requestRendererFlushBeforeWindowClose: () => Promise<void> | undefined;
}

const createWindow = ({ requestRendererFlushBeforeWindowClose }: CreateWindowOptions): void => {
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

	// Closing the window destroys the renderer without quitting on macOS and before the quit drain elsewhere, so the buffered task
	// edits are saved here through the same handshake, and the window is destroyed only once the renderer reported
	win.on('close', (event) => {
		const rendererFlushPromise = requestRendererFlushBeforeWindowClose();

		if(!rendererFlushPromise) {
			return;
		}

		event.preventDefault();

		void rendererFlushPromise.then(() => {
			if(!win.isDestroyed()) {
				win.destroy();
			}
		});
	});

	win.on('closed', () => {
		if(mainWindow === win) {
			mainWindow = undefined;
		}
	});

	void win.loadFile(loadTarget.value);
};

void app.whenReady().then(async() => {
	const runtimePaths = resolveSpotRuntimePaths(app);

	initializeAppLogger({
		logDirectory: runtimePaths.logDirectory,
		fileName: LOGGING_CONFIG.fileName,
		maximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
		retainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount
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

	const { runExclusively, requestRendererFlushBeforeWindowClose } = registerTaskStorageIpcHandlers({
		app,
		ipcMain,
		taskStorage,
		getRendererFlushTarget: () => {
			return mainWindow?.webContents;
		},
		onTaskCommandApplied: () => {
			backupScheduler?.notifyDataChanged();
		},
		onRendererFlushCompleted: () => {
			// Draining, backing up and closing the database takes seconds, and a backup folder that stopped answering uses all of
			// BACKUP_CONFIG.shutdownTimeoutMs. A window left on screen stays interactive for that whole time while every task change
			// it collects is refused, so it goes away as soon as the renderer saved what it had.
			if(mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.hide();
			}
		},
		onBeforeStorageShutdown: () => {
			return backupScheduler?.runFinalBackup() ?? Promise.resolve();
		}
	});

	backupScheduler = createBackupScheduler({
		storage: taskStorage,
		delayAfterChangeMs: BACKUP_CONFIG.delayAfterChangeMs,
		shutdownTimeoutMs: BACKUP_CONFIG.shutdownTimeoutMs,
		runExclusively,
		onBackupStatusChanged: (status: BackupStatus) => {
			if(mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.webContents.send(SPOT_STORAGE_IPC_CHANNELS.backupStatusChanged, status);
			}
		}
	});

	const backupLocationManager = createBackupLocationManager({
		runtimePaths,
		storage: taskStorage,
		directoryStore: createSpotBackupDirectoryStore(createSpotConfigStore(runtimePaths.configFilePath)),
		runExclusively,
		onBackupDirectoryChanged: () => {
			backupScheduler?.notifyDataChanged();
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

	createWindow({ requestRendererFlushBeforeWindowClose });

	app.on('activate', () => {
		if(BrowserWindow.getAllWindows().length === 0) {
			createWindow({ requestRendererFlushBeforeWindowClose });
		}
	});
});

app.on('window-all-closed', () => {
	if(process.platform !== 'darwin') {
		app.quit();
	}
});
