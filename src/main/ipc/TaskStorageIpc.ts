import type { App, IpcMain } from 'electron';
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

export interface TaskStorageCommandController {
	runExclusively: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;
}

export interface RegisterTaskStorageIpcHandlersOptions {
	ipcMain: TaskStorageIpcMain;
	taskStorage: TaskStorageIpcApi;
	app?: TaskStorageIpcApp;
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

const createTaskStorageCommandController = (
	taskStorage: TaskStorageIpcApi,
	app?: TaskStorageIpcApp
): Pick<TaskStorageIpcApi, 'executeTaskCommand'> & TaskStorageCommandController => {
	const pendingCommands = new Set<Promise<unknown>>();
	let isShuttingDown = false;
	let isQuitAllowed = false;
	let shutdownPromise: Promise<void> | undefined;
	let exclusiveOperation: Promise<void> | undefined;

	const prepareForShutdown = async(): Promise<void> => {
		await Promise.allSettled(Array.from(pendingCommands));
		try {
			await taskStorage.prepareForShutdown?.();
		}
		finally {
			await spotLogger.flush();
		}
	};

	const requestShutdown = (): void => {
		isShuttingDown = true;

		if(shutdownPromise) {
			return;
		}

		shutdownPromise = prepareForShutdown()
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

	const trackPendingCommand = (commandPromise: Promise<TaskStorageCommandResult>): Promise<TaskStorageCommandResult> => {
		pendingCommands.add(commandPromise);

		return commandPromise.finally(() => {
			pendingCommands.delete(commandPromise);
		});
	};

	// Lets the storage folder change finalize the commands already running on the old database, while later commands wait for the new database instead of racing the switch
	const runExclusively = async<TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
		const commandsToDrain = Array.from(pendingCommands);
		let releaseExclusiveOperation: (() => void) | undefined;
		exclusiveOperation = new Promise<void>((resolve) => {
			releaseExclusiveOperation = resolve;
		});

		try {
			await Promise.allSettled(commandsToDrain);

			return await operation();
		}
		finally {
			exclusiveOperation = undefined;
			releaseExclusiveOperation?.();
		}
	};

	return {
		executeTaskCommand: (command) => {
			if(isShuttingDown) {
				return createShutdownCommandResult(taskStorage);
			}

			if(exclusiveOperation) {
				return trackPendingCommand(exclusiveOperation.then(() => {
					return taskStorage.executeTaskCommand(command);
				}));
			}

			return trackPendingCommand(taskStorage.executeTaskCommand(command));
		},
		runExclusively
	};
};

export const registerTaskStorageIpcHandlers = ({
	ipcMain,
	taskStorage,
	app
}: RegisterTaskStorageIpcHandlersOptions): TaskStorageCommandController => {
	const commandController = createTaskStorageCommandController(taskStorage, app);

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.loadTasks, () => {
		return taskStorage.loadTasks();
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand, (_event, command: TaskStorageCommand) => {
		return commandController.executeTaskCommand(command);
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.getStorageStatus, () => {
		return taskStorage.getStorageStatus();
	});

	return {
		runExclusively: commandController.runExclusively
	};
};
