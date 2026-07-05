import path from 'node:path';
import type { App, IpcMain } from 'electron';
import { spotLogger } from 'src/main/logging/SpotLogger';
import { createTaskStorage, type CreateTaskStorageOptions, type TaskStorage } from 'src/main/storage/TaskStorage';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';
import type { StorageStatus, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

export const SPOT_STORAGE_DIRECTORY_NAME = 'storage';
export const TASK_STORAGE_SHUTDOWN_MESSAGE = 'Task storage is shutting down.';
export { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';

type TaskStorageIpcMain = Pick<IpcMain, 'handle'>;

type TaskStorageIpcApp = Pick<App, 'getPath'> & Partial<Pick<App, 'on' | 'quit'>>;

type TaskStorageIpcApi = Pick<TaskStorage, 'loadTasks' | 'executeTaskCommand' | 'getStorageStatus'> & Partial<Pick<TaskStorage, 'prepareForShutdown'>>;

type TaskStorageFactory = (options: CreateTaskStorageOptions) => TaskStorageIpcApi;

interface BeforeQuitEvent {
	preventDefault: () => void;
}

export interface RegisterTaskStorageIpcHandlersOptions {
	ipcMain: TaskStorageIpcMain;
	app?: TaskStorageIpcApp;
	taskStorage?: TaskStorageIpcApi;
	createStorage?: TaskStorageFactory;
}

export const resolveSpotStorageDirectory = (app: Pick<App, 'getPath'>): string => {
	return path.join(app.getPath('userData'), SPOT_STORAGE_DIRECTORY_NAME);
};

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

const createTaskStorageCommandShutdownController = (
	taskStorage: TaskStorageIpcApi,
	app?: TaskStorageIpcApp
): Pick<TaskStorageIpcApi, 'executeTaskCommand'> => {
	const pendingCommands = new Set<Promise<unknown>>();
	let isShuttingDown = false;
	let isQuitAllowed = false;
	let shutdownPromise: Promise<void> | undefined;

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

	return {
		executeTaskCommand: (command) => {
			if(isShuttingDown) {
				return createShutdownCommandResult(taskStorage);
			}

			const pendingCommand = taskStorage.executeTaskCommand(command);
			pendingCommands.add(pendingCommand);

			return pendingCommand.finally(() => {
				pendingCommands.delete(pendingCommand);
			});
		}
	};
};

const createDefaultTaskStorage = ({
	app,
	createStorage = createTaskStorage
}: Pick<RegisterTaskStorageIpcHandlersOptions, 'app' | 'createStorage'>): TaskStorageIpcApi => {
	if(!app) {
		return createStorage({});
	}

	return createStorage({
		storageDirectory: resolveSpotStorageDirectory(app)
	});
};

export const registerTaskStorageIpcHandlers = ({
	ipcMain,
	app,
	createStorage,
	taskStorage = createDefaultTaskStorage({ app, createStorage })
}: RegisterTaskStorageIpcHandlersOptions): void => {
	const shutdownController = createTaskStorageCommandShutdownController(taskStorage, app);

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.loadTasks, () => {
		return taskStorage.loadTasks();
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand, (_event, command: TaskStorageCommand) => {
		return shutdownController.executeTaskCommand(command);
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.getStorageStatus, () => {
		return taskStorage.getStorageStatus();
	});
};
