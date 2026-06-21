import path from 'node:path';
import type { App, IpcMain, IpcMainInvokeEvent } from 'electron';
import { makeTask } from '../testUtils';
import { registerTaskStorageIpcHandlers, resolveSpotStorageDirectory, SPOT_STORAGE_DIRECTORY_NAME, SPOT_STORAGE_IPC_CHANNELS } from 'src/main/ipc/TaskStorageIpc';
import type { TaskStorage } from 'src/main/storage/TaskStorage';
import type { LoadTasksResult, StorageStatus, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const createMockIpcMain = (): {
	handlers: Map<string, RegisteredIpcHandler>;
	ipcMain: Pick<IpcMain, 'handle'>;
} => {
	const handlers = new Map<string, RegisteredIpcHandler>();
	const ipcMain = {
		handle: jest.fn((channel: string, handler: RegisteredIpcHandler) => {
			handlers.set(channel, handler);
		})
	};

	return {
		handlers,
		ipcMain
	};
};

const createStorageStatus = (): StorageStatus => {
	return {
		database: {
			state: 'healthy'
		},
		storageDirectory: '/tmp/spot-storage',
		databasePath: '/tmp/spot-storage/spot.sqlite'
	};
};

const createMockTaskStorage = (): {
	loadTasksResult: LoadTasksResult;
	status: StorageStatus;
	commandResult: TaskStorageCommandResult;
	taskStorage: Pick<TaskStorage, 'loadTasks' | 'executeTaskCommand' | 'getStorageStatus'>;
} => {
	const status = createStorageStatus();
	const loadTasksResult: LoadTasksResult = {
		ok: true,
		tasks: [
			makeTask({
				id: 'stored-task',
				text: 'Stored task'
			})
		],
		status
	};
	const commandResult: TaskStorageCommandResult = {
		ok: true,
		status
	};
	const taskStorage = {
		loadTasks: jest.fn(async() => {
			return loadTasksResult;
		}),
		executeTaskCommand: jest.fn(async() => {
			return commandResult;
		}),
		getStorageStatus: jest.fn(async() => {
			return status;
		})
	};

	return {
		loadTasksResult,
		status,
		commandResult,
		taskStorage
	};
};

describe('TaskStorageIpc', () => {
	test('resolves the Electron storage directory from app userData', () => {
		const userDataPath = path.join('/tmp', 'spot-user-data');
		const app = {
			getPath: jest.fn(() => {
				return userDataPath;
			})
		} as unknown as Pick<App, 'getPath'>;

		expect(resolveSpotStorageDirectory(app)).toBe(path.join(userDataPath, SPOT_STORAGE_DIRECTORY_NAME));
		expect(app.getPath).toHaveBeenCalledWith('userData');
	});

	test('registers storage handlers on the narrow IPC channels', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { commandResult, loadTasksResult, status, taskStorage } = createMockTaskStorage();
		const event = {} as IpcMainInvokeEvent;
		const command: TaskStorageCommand = {
			command: 'task.update',
			payload: {
				taskId: 'stored-task',
				change: {
					text: 'Updated stored task'
				}
			}
		};

		registerTaskStorageIpcHandlers({
			ipcMain,
			taskStorage
		});

		expect(ipcMain.handle).toHaveBeenCalledTimes(3);
		expect(Array.from(handlers.keys())).toEqual([
			SPOT_STORAGE_IPC_CHANNELS.loadTasks,
			SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand,
			SPOT_STORAGE_IPC_CHANNELS.getStorageStatus
		]);
		await expect(handlers.get(SPOT_STORAGE_IPC_CHANNELS.loadTasks)!(event)).resolves.toBe(loadTasksResult);
		await expect(handlers.get(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand)!(event, command)).resolves.toBe(commandResult);
		await expect(handlers.get(SPOT_STORAGE_IPC_CHANNELS.getStorageStatus)!(event)).resolves.toBe(status);
		expect(taskStorage.loadTasks).toHaveBeenCalledTimes(1);
		expect(taskStorage.executeTaskCommand).toHaveBeenCalledWith(command);
		expect(taskStorage.getStorageStatus).toHaveBeenCalledTimes(1);
	});

	test('creates configured task storage when no storage instance is injected', () => {
		const { ipcMain } = createMockIpcMain();
		const { taskStorage } = createMockTaskStorage();
		const userDataPath = path.join('/tmp', 'spot-user-data');
		const app = {
			getPath: jest.fn(() => {
				return userDataPath;
			})
		} as unknown as Pick<App, 'getPath'>;
		const createStorage = jest.fn(() => {
			return taskStorage;
		});

		registerTaskStorageIpcHandlers({
			ipcMain,
			app,
			createStorage
		});

		expect(createStorage).toHaveBeenCalledWith({
			storageDirectory: path.join(userDataPath, SPOT_STORAGE_DIRECTORY_NAME)
		});
	});
});
