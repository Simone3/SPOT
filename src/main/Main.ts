import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { BACKUP_CONFIG, LOGGING_CONFIG, WINDOW_CONFIG } from 'src/config/AppConfig';
import { createBackupLocationManager } from 'src/framework/main/config/BackupLocationManager';
import { appLogger, initializeAppLogger } from 'src/framework/main/logging/AppLogger';
import { installProcessCrashHandlers } from 'src/framework/main/logging/ProcessCrashHandlers';
import { createBackupScheduler, type BackupScheduler } from 'src/framework/main/storage/BackupScheduler';
import type { BackupDirectoryMessages } from 'src/framework/main/storage/BackupDirectory';
import type { BackupStatus } from 'src/framework/types/StorageTypes';
import { installWindowNavigationGuard } from 'src/framework/main/window/WindowNavigationGuard';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import { createSpotTranslator, resolveSpotLanguage, type SpotTranslator } from 'src/i18n/Translations';
import { createSpotBackupDirectoryStore, createSpotConfigStore } from 'src/main/config/SpotConfigStore';
import { resolveSpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { registerAppInfoIpcHandlers } from 'src/main/ipc/AppInfoIpc';
import { registerBackupLocationIpcHandlers } from 'src/main/ipc/BackupLocationIpc';
import { registerDiagnosticsIpcHandlers } from 'src/main/ipc/DiagnosticsIpc';
import { registerTaskStorageIpcHandlers } from 'src/main/ipc/TaskStorageIpc';
import { createTaskStorage } from 'src/main/storage/TaskStorage';
import { installSpotApplicationMenu } from 'src/main/window/AppMenu';
import { isDevelopmentRun, resolveWindowLoadTarget, type WindowLoadTarget } from 'src/main/window/WindowLoadTarget';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';

let mainWindow: BrowserWindow | undefined;

// Only the first failure opens a dialog. A process that started failing usually keeps failing, and a stack of error boxes would
// bury the window instead of reporting anything the first one did not already say.
let hasReportedFatalError = false;

// Set once the renderer stopped collecting task changes, so a second launch arriving during a quit does not put the window back on screen
let isShuttingDown = false;

// Why a backup folder cannot be used. The framework decides which of these applies, so SPOT only supplies the wording.
const createSpotBackupDirectoryMessages = (translator: SpotTranslator): BackupDirectoryMessages => {
	return {
		noDirectorySelected: translator.t('backup.directory.noneSelected'),
		createMissingDirectoryMessage: (directory) => {
			return translator.t('backup.directory.missing', { directory });
		},
		createNotADirectoryMessage: (directory) => {
			return translator.t('backup.directory.notADirectory', { directory });
		},
		createUnusableDirectoryMessage: (directory) => {
			return translator.t('backup.directory.unusable', { directory });
		}
	};
};

// Set as soon as the application knows which language to speak, so that a failure after that point can be worded for the user
let fatalErrorTranslator: SpotTranslator | undefined;

/**
 * Tells the user about a failure that reached the top of the main process.
 * The log always has it by the time this runs, so this only decides whether there is anything worth putting in front of the user.
 * @param message The failure, as a message.
 */
const reportFatalErrorToUser = (message: string): void => {
	// A failure before the language is resolved is a failure to start at all: there is no window and no wording, and the log file
	// is the only place it can be reported from
	if(hasReportedFatalError || !fatalErrorTranslator) {
		return;
	}

	hasReportedFatalError = true;

	dialog.showErrorBox(
		fatalErrorTranslator.t('crash.mainProcessTitle'),
		fatalErrorTranslator.t('crash.mainProcessMessage', { message })
	);
};

// The window is only ever allowed on the page the main process loaded into it, which the guard needs as a URL
const getAllowedNavigationUrl = (loadTarget: WindowLoadTarget): string => {
	return loadTarget.type === 'url' ? loadTarget.value : pathToFileURL(loadTarget.value).href;
};

// "requestRendererFlushBeforeWindowClose" saves the task changes the renderer still buffers, or returns undefined when the window can close right away
interface CreateWindowOptions {
	requestRendererFlushBeforeWindowClose: () => Promise<void> | undefined;

	// What the window loads, resolved once at startup so that every window of this run loads the same page and the menu was decided from it
	loadTarget: WindowLoadTarget;
}

const createWindow = ({ requestRendererFlushBeforeWindowClose, loadTarget }: CreateWindowOptions): void => {
	const win = new BrowserWindow({
		width: WINDOW_CONFIG.widthPixels,
		height: WINDOW_CONFIG.heightPixels,
		show: false,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, WINDOW_CONFIG.preloadScriptFileName)
		}
	});

	// Maximizes to the screen work area on startup without engaging macOS native fullscreen (a distinct window state the user opts into separately)
	win.once('ready-to-show', () => {
		win.maximize();
		win.show();
	});

	// The renderer's Content-Security-Policy says what the page may load, not where it may go. Without this, a link or a script
	// could navigate the window onto a page of its own, and that page would sit behind the preload bridge.
	installWindowNavigationGuard({
		webContents: win.webContents,
		allowedUrl: getAllowedNavigationUrl(loadTarget),
		onNavigationBlocked: (url) => {
			appLogger.warn('Blocked a navigation away from the SPOT window', {
				type: 'blocked-navigation',
				url
			});
		}
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

	if(loadTarget.type === 'url') {
		void win.loadURL(loadTarget.value);
	}
	else {
		void win.loadFile(loadTarget.value);
	}
};

// What a second launch gets instead of a second instance: the window the first one already has
const revealMainWindow = (): void => {
	if(!mainWindow || mainWindow.isDestroyed() || isShuttingDown) {
		return;
	}

	if(mainWindow.isMinimized()) {
		mainWindow.restore();
	}

	mainWindow.show();
	mainWindow.focus();
};

const startApplication = (): void => {
	// Installed before anything can fail. An exception that reaches the top of the process, or a promise nobody handled, would
	// otherwise leave nothing behind at all: the startup below runs inside a promise, so a throw in it would take the window with
	// it without a word anywhere.
	installProcessCrashHandlers({
		process,
		onFatalError: ({ message }) => {
			reportFatalErrorToUser(message);
		}
	});

	const startup = app.whenReady().then(async() => {
		// Resolved first, so that every failure from here on has wording to report itself with. The main process words the native
		// folder dialog and the failures it reports back to the renderer, so it resolves the language from the operating system
		// the same way the renderer resolves it from the browser.
		const translator = createSpotTranslator(resolveSpotLanguage([ app.getLocale() ]));
		fatalErrorTranslator = translator;

		// Resolved before the window, because the menu is decided from it and every window of this run then loads the same page
		const loadTarget = resolveWindowLoadTarget({
			appRootDirectory: app.getAppPath(),
			isPackaged: app.isPackaged
		});

		// Replaces the menu Electron installs by itself, which carries the reload and developer tools entries an installed SPOT
		// should not offer. A development run keeps that default menu instead.
		installSpotApplicationMenu({
			menu: Menu,
			isDevelopmentRun: isDevelopmentRun(loadTarget),
			translator,
			platform: process.platform
		});

		const runtimePaths = resolveSpotRuntimePaths(app);

		initializeAppLogger({
			logDirectory: runtimePaths.logDirectory,
			fileName: LOGGING_CONFIG.fileName,
			maximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
			retainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount
		});

		const taskStorage = createTaskStorage({
			databaseDirectory: runtimePaths.databaseDirectory,
			backupDirectory: runtimePaths.defaultBackupDirectory,
			translator
		});

		registerAppInfoIpcHandlers({ ipcMain, app });

		// Registered after the logger, which is the file it writes what the renderer reports to
		registerDiagnosticsIpcHandlers({ ipcMain });

		// The scheduler needs the storage chain that registering the handlers returns, and the handlers need the scheduler to start and finish backups
		let backupScheduler: BackupScheduler | undefined;

		const { runExclusively, requestRendererFlushBeforeWindowClose } = registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage,
			translator,
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
				isShuttingDown = true;

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
			directoryMessages: createSpotBackupDirectoryMessages(translator),
			runExclusively,
			onBackupDirectoryChanged: () => {
				backupScheduler?.notifyDataChanged();
			}
		});

		registerBackupLocationIpcHandlers({
			ipcMain,
			dialog,
			backupLocationManager,
			translator,
			getParentWindow: () => {
				return mainWindow;
			}
		});

		await backupLocationManager.initialize();

		createWindow({ requestRendererFlushBeforeWindowClose, loadTarget });

		app.on('activate', () => {
			if(BrowserWindow.getAllWindows().length === 0) {
				createWindow({ requestRendererFlushBeforeWindowClose, loadTarget });
			}
		});
	});

	// Startup runs to the point where the window exists, so anything that throws before that leaves no window and no way to try
	// again. It is reported and the application is quit, rather than left running with nothing on screen.
	void startup.catch((error: unknown) => {
		const message = getErrorMessage(error);

		appLogger.error(message, {
			type: 'startup-failed',
			stack: error instanceof Error ? error.stack : undefined
		});
		reportFatalErrorToUser(message);
		app.quit();
	});

	app.on('window-all-closed', () => {
		if(process.platform !== 'darwin') {
			app.quit();
		}
	});
};

// The Windows installer runs SPOT itself to set up and tear down its shortcuts, passing the step as a command line argument. Those
// runs are the installer's, not the user's: "electron-squirrel-startup" does that step and reports that it did, and SPOT then quits
// instead of opening a window nobody asked for in the middle of an install, an update or an uninstall. It is false on every other
// platform and on every normal launch. This comes before the lock, because the installer can run these while SPOT is open.
if(squirrelStartup) {
	app.quit();
}

// Two SPOT processes would hold the same database open. SQLite keeps the file itself consistent, but the two task states do not stay
// consistent with it: each renderer reads the tasks once at startup and writes optimistically afterwards, so everything one process
// saves is invisible to the other, whose own writes then go on top of it, and whose audit reports the result as a drift. The two
// backup schedulers and the two loggers would also rotate the same files underneath each other. Only the first instance therefore runs.
else if(app.requestSingleInstanceLock()) {
	// A second launch is a request to use SPOT, and SPOT is already running: it gets the window the first instance has
	app.on('second-instance', () => {
		revealMainWindow();
	});

	startApplication();
}
else {
	// Quitting before "ready" starts nothing: no database is opened, no log file is written, and no backup is scheduled
	app.quit();
}
