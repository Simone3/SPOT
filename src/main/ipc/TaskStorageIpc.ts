import path from 'node:path';
import type { App, IpcMain } from 'electron';
import { createTaskStorage, type CreateTaskStorageOptions, type TaskStorage } from 'src/main/storage/TaskStorage';
import type { TaskStorageCommand } from 'src/types/TaskStorageTypes';

export const SPOT_STORAGE_DIRECTORY_NAME = 'storage';

export const SPOT_STORAGE_IPC_CHANNELS = {
	loadTasks: 'spot-storage:load-tasks',
	executeTaskCommand: 'spot-storage:execute-task-command',
	getStorageStatus: 'spot-storage:get-storage-status'
} as const;

type TaskStorageIpcMain = Pick<IpcMain, 'handle'>;

type TaskStorageIpcApi = Pick<TaskStorage, 'loadTasks' | 'executeTaskCommand' | 'getStorageStatus'>;

type TaskStorageFactory = (options: CreateTaskStorageOptions) => TaskStorageIpcApi;

export interface RegisterTaskStorageIpcHandlersOptions {
	ipcMain: TaskStorageIpcMain;
	app?: Pick<App, 'getPath'>;
	taskStorage?: TaskStorageIpcApi;
	createStorage?: TaskStorageFactory;
}

export const resolveSpotStorageDirectory = (app: Pick<App, 'getPath'>): string => {
	return path.join(app.getPath('userData'), SPOT_STORAGE_DIRECTORY_NAME);
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
	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.loadTasks, () => {
		return taskStorage.loadTasks();
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand, (_event, command: TaskStorageCommand) => {
		return taskStorage.executeTaskCommand(command);
	});

	ipcMain.handle(SPOT_STORAGE_IPC_CHANNELS.getStorageStatus, () => {
		return taskStorage.getStorageStatus();
	});
};
