import type { App, IpcMain } from 'electron';
import { SHUTDOWN_CONFIG } from 'src/config/AppConfig';
import { spotLogger } from 'src/main/logging/SpotLogger';
import type { TaskStorage } from 'src/main/storage/TaskStorage';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';
import type { StorageStatus, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

export const TASK_STORAGE_SHUTDOWN_MESSAGE = 'Task storage is shutting down.';
export { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';

type TaskStorageIpcMain = Pick<IpcMain, 'handle'>;

type TaskStorageIpcApp = Partial<Pick<App, 'on' | 'quit'>>;

type TaskStorageIpcApi = Pick<TaskStorage, 'loadTasks' | 'executeTaskCommand' | 'getStorageStatus'> & Partial<Pick<TaskStorage, 'prepareForShutdown'>>;

interface BeforeQuitEvent {
	preventDefault: () => void;
}

export interface RendererFlushTarget {
	send: (channel: string) => void;
	isDestroyed?: () => boolean;
}

export interface TaskStorageCommandController {
	runExclusively: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;

	// Runs the renderer flush handshake for a window that is about to close, or returns undefined when the window has nothing to wait for
	requestRendererFlushBeforeWindowClose: () => Promise<void> | undefined;
}

export interface RegisterTaskStorageIpcHandlersOptions {
	ipcMain: TaskStorageIpcMain;
	taskStorage: TaskStorageIpcApi;
	app?: TaskStorageIpcApp;
	getRendererFlushTarget?: () => RendererFlushTarget | undefined;

	// Called after every command that reached the database, so the backup schedule can be restarted
	onTaskCommandApplied?: () => void;

	// Called once the in-flight commands are done and before the database is closed, so a last backup can still read it
	onBeforeStorageShutdown?: () => Promise<void>;
}

const createShutdownStorageStatus = (): StorageStatus => {
	return {
		database: {
			state: 'unavailable',
			message: TASK_STORAGE_SHUTDOWN_MESSAGE
		}
	};
};

const readStorageStatusSafely = async(taskStorage: TaskStorageIpcApi): Promise<StorageStatus> => {
	try {
		return await taskStorage.getStorageStatus();
	}
	catch {
		return createShutdownStorageStatus();
	}
};

const createShutdownCommandResult = async(taskStorage: TaskStorageIpcApi): Promise<TaskStorageCommandResult> => {
	return {
		ok: false,
		reason: 'shutdown',
		message: TASK_STORAGE_SHUTDOWN_MESSAGE,
		status: await readStorageStatusSafely(taskStorage)
	};
};

const createTaskStorageCommandController = ({
	taskStorage,
	app,
	getRendererFlushTarget,
	onTaskCommandApplied,
	onBeforeStorageShutdown
}: RegisterTaskStorageIpcHandlersOptions): Pick<TaskStorageIpcApi, 'loadTasks' | 'executeTaskCommand'> & TaskStorageCommandController & {
	notifyPendingTaskChangesFlushed: () => void;
} => {
	// Everything that touches the database runs on this chain, so task commands and storage folder changes are strictly
	// ordered and can never overlap, whichever order they are requested in
	let storageOperations: Promise<unknown> = Promise.resolve();
	let isShuttingDown = false;
	let isQuitAllowed = false;
	let shutdownPromise: Promise<void> | undefined;
	let rendererFlushPromise: Promise<void> | undefined;
	let finishRendererFlush: (() => void) | undefined;

	const runOnStorage = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
		const operationResult = storageOperations.then(() => {
			return operation();
		});

		// The chain has to survive a failed operation, or nothing would run after it
		storageOperations = operationResult.then(() => {
			return undefined;
		}, () => {
			return undefined;
		});

		return operationResult;
	};

	const drainStorageOperations = async(): Promise<void> => {
		let drainedOperations;

		// An operation can be appended while the previous ones are being awaited
		do {
			drainedOperations = storageOperations;
			await drainedOperations;
		}
		while(drainedOperations !== storageOperations);
	};

	// The last backup runs once nothing is left to write and while the database is still open, and it is best effort: a backup folder that
	// cannot be reached must never keep the app from quitting
	const runFinalBackup = async(): Promise<void> => {
		try {
			await onBeforeStorageShutdown?.();
		}
		catch(error) {
			spotLogger.error('The backup written during shutdown failed', {
				type: 'storage.backup',
				error: error instanceof Error ? error.message : String(error)
			});
		}
	};

	const prepareForShutdown = async(): Promise<void> => {
		await drainStorageOperations();
		await runFinalBackup();
		try {
			await taskStorage.prepareForShutdown?.();
		}
		finally {
			await spotLogger.flush();
		}
	};

	// React buffers task edits for a few seconds, so the renderer gets a bounded chance to save them before the database is closed.
	// Task commands are still accepted while this runs: rejecting them here is exactly what would lose the buffered edits.
	const requestRendererFlush = (): Promise<void> | undefined => {
		const flushTarget = getRendererFlushTarget?.();

		if(!flushTarget || flushTarget.isDestroyed?.()) {
			return undefined;
		}

		return new Promise<void>((resolve) => {
			let flushTimeout: ReturnType<typeof setTimeout> | undefined;
			const finishFlush = (): void => {
				if(!finishRendererFlush) {
					return;
				}

				finishRendererFlush = undefined;
				clearTimeout(flushTimeout);
				resolve();
			};

			flushTimeout = setTimeout(finishFlush, SHUTDOWN_CONFIG.rendererFlushTimeoutMs);
			finishRendererFlush = finishFlush;

			try {
				flushTarget.send(SPOT_STORAGE_IPC_CHANNELS.flushPendingTaskChanges);
			}
			catch(error) {
				spotLogger.warn('Could not ask the renderer to flush pending task changes', {
					type: 'storage.shutdown',
					error: error instanceof Error ? error.message : String(error)
				});
				finishFlush();
			}
		});
	};

	// A window closing while the application is quitting, or the other way around, must join the handshake that is already
	// running instead of starting a second one the renderer would answer only once
	const requestRendererFlushOnce = (): Promise<void> | undefined => {
		if(rendererFlushPromise) {
			return rendererFlushPromise;
		}

		const flushPromise = requestRendererFlush();

		if(!flushPromise) {
			return undefined;
		}

		rendererFlushPromise = flushPromise.then(() => {
			rendererFlushPromise = undefined;
		});

		return rendererFlushPromise;
	};

	// Closing the window destroys the renderer, and on macOS the application even keeps running afterwards, so the buffered task
	// edits have to be saved when the window goes away and not only when the application quits
	const requestRendererFlushBeforeWindowClose = (): Promise<void> | undefined => {
		// The window closes as part of a quit that already runs the same handshake and closes the database right after it
		if(shutdownPromise) {
			return undefined;
		}

		return requestRendererFlushOnce();
	};

	const requestShutdown = (): void => {
		if(shutdownPromise) {
			return;
		}

		const pendingRendererFlush = requestRendererFlushOnce();

		// Without a renderer to wait for, shutdown starts right away and later commands are refused immediately
		if(!pendingRendererFlush) {
			isShuttingDown = true;
		}

		shutdownPromise = (pendingRendererFlush ?? Promise.resolve())
			.then(() => {
				isShuttingDown = true;

				return prepareForShutdown();
			})
			.catch(() => {
				return undefined;
			})
			.then(() => {
				isQuitAllowed = true;
				app?.quit?.();
			});
	};

	app?.on?.('before-quit', (event: BeforeQuitEvent) => {
		if(isQuitAllowed) {
			return;
		}

		event.preventDefault();
		requestShutdown();
	});

	// Lets a storage folder change finalize the commands already running on the old database, while later commands wait
	// for the new database instead of racing the switch, and a second folder change waits for the first to finish
	const runExclusively = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
		return runOnStorage(operation);
	};

	return {
		loadTasks: () => {
			return runOnStorage(() => {
				return taskStorage.loadTasks();
			});
		},
		executeTaskCommand: async(command) => {
			if(isShuttingDown) {
				return createShutdownCommandResult(taskStorage);
			}

			const result = await runOnStorage(() => {
				return taskStorage.executeTaskCommand(command);
			});

			if(result.ok) {
				onTaskCommandApplied?.();
			}

			return result;
		},
		runExclusively,
		requestRendererFlushBeforeWindowClose,
		notifyPendingTaskChangesFlushed: () => {
			finishRendererFlush?.();
		}
	};
};

export const registerTaskStorageIpcHandlers = (options: RegisterTaskStorageIpcHandlersOptions): TaskStorageCommandController => {
	const { ipcMain, taskStorage } = options;
	const commandController = createTaskStorageCommandController(options);

	// Loading also goes through the chain, so tasks are never read from a database that is being replaced
	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.loadTasks, () => {
		return commandController.loadTasks();
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand, (_event, command: TaskStorageCommand) => {
		return commandController.executeTaskCommand(command);
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.getStorageStatus, () => {
		return taskStorage.getStorageStatus();
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed, () => {
		commandController.notifyPendingTaskChangesFlushed();
	});

	return {
		runExclusively: commandController.runExclusively,
		requestRendererFlushBeforeWindowClose: commandController.requestRendererFlushBeforeWindowClose
	};
};
