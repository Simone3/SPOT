import type { App, IpcMain, IpcMainInvokeEvent } from 'electron';
import { makeTask } from '../testUtils';
import { resetSpotLoggerForTests, spotLogger } from 'src/main/logging/SpotLogger';
import { registerTaskStorageIpcHandlers, SPOT_STORAGE_IPC_CHANNELS, TASK_STORAGE_SHUTDOWN_MESSAGE } from 'src/main/ipc/TaskStorageIpc';
import type { TaskStorage } from 'src/main/storage/TaskStorage';
import type { LoadTasksResult, StorageStatus, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
type RegisteredAppHandler = (...args: unknown[]) => unknown;

const createDeferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve: (value: T) => void = () => {};
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve;
	});

	return {
		promise,
		resolve
	};
};

const waitForQueuedWork = (): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};

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

const createMockApp = (): {
	app: Pick<App, 'on' | 'quit'>;
	handlers: Map<string, RegisteredAppHandler>;
} => {
	const handlers = new Map<string, RegisteredAppHandler>();
	const app = {
		on: jest.fn((eventName: string, handler: RegisteredAppHandler) => {
			handlers.set(eventName, handler);
			return undefined;
		}),
		quit: jest.fn()
	} as unknown as Pick<App, 'on' | 'quit'>;

	return {
		app,
		handlers
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
	afterEach(() => {
		jest.restoreAllMocks();
		resetSpotLoggerForTests();
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

	test('waits for in-flight task commands and prepares storage before quitting', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { commandResult, taskStorage } = createMockTaskStorage();
		const commandDeferred = createDeferred<TaskStorageCommandResult>();
		taskStorage.executeTaskCommand = jest.fn(() => {
			return commandDeferred.promise;
		});
		const prepareForShutdown = jest.fn(async() => {
			return undefined;
		});
		const flushLogger = jest.spyOn(spotLogger, 'flush').mockResolvedValue(undefined);
		const event = {} as IpcMainInvokeEvent;
		const beforeQuitEvent = {
			preventDefault: jest.fn()
		};
		const command: TaskStorageCommand = {
			command: 'task.update',
			payload: {
				taskId: 'stored-task',
				change: {
					text: 'Updated before quit'
				}
			}
		};

		registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage: {
				...taskStorage,
				prepareForShutdown
			}
		});

		const commandPromise = handlers.get(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand)!(event, command) as Promise<TaskStorageCommandResult>;
		const beforeQuitHandler = appHandlers.get('before-quit')!;

		beforeQuitHandler(beforeQuitEvent);

		expect(beforeQuitEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(app.quit).not.toHaveBeenCalled();
		expect(prepareForShutdown).not.toHaveBeenCalled();

		commandDeferred.resolve(commandResult);
		await expect(commandPromise).resolves.toBe(commandResult);
		await waitForQueuedWork();

		expect(prepareForShutdown).toHaveBeenCalledTimes(1);
		expect(flushLogger).toHaveBeenCalledTimes(1);
		expect(app.quit).toHaveBeenCalledTimes(1);
	});

	test('returns a clear shutdown failure for new task commands after shutdown begins', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { status, taskStorage } = createMockTaskStorage();
		const event = {} as IpcMainInvokeEvent;
		const beforeQuitEvent = {
			preventDefault: jest.fn()
		};
		const command: TaskStorageCommand = {
			command: 'task.update',
			payload: {
				taskId: 'stored-task',
				change: {
					text: 'Late update'
				}
			}
		};

		registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage
		});

		appHandlers.get('before-quit')!(beforeQuitEvent);

		await expect(handlers.get(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand)!(event, command)).resolves.toEqual({
			ok: false,
			reason: 'shutdown',
			message: TASK_STORAGE_SHUTDOWN_MESSAGE,
			status
		});
		expect(taskStorage.executeTaskCommand).not.toHaveBeenCalled();
		expect(taskStorage.getStorageStatus).toHaveBeenCalledTimes(1);
	});
	test('finalizes in-flight task commands before a storage folder change and queues later commands', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { commandResult, taskStorage } = createMockTaskStorage();
		const firstCommandDeferred = createDeferred<TaskStorageCommandResult>();
		const executionOrder: string[] = [];
		taskStorage.executeTaskCommand = jest.fn((command: TaskStorageCommand) => {
			const { taskId } = command.payload as { taskId: string };
			executionOrder.push(`command-${taskId}`);

			return taskId === 'first' ? firstCommandDeferred.promise : Promise.resolve(commandResult);
		});
		const event = {} as IpcMainInvokeEvent;
		const createUpdateCommand = (taskId: string): TaskStorageCommand => {
			return {
				command: 'task.update',
				payload: {
					taskId,
					change: {
						text: `Update ${taskId}`
					}
				}
			};
		};

		const { runExclusively } = registerTaskStorageIpcHandlers({
			ipcMain,
			taskStorage
		});
		const executeTaskCommandHandler = handlers.get(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand)!;

		const firstCommandPromise = executeTaskCommandHandler(event, createUpdateCommand('first')) as Promise<TaskStorageCommandResult>;
		const storageChangePromise = runExclusively(() => {
			executionOrder.push('storage-change');

			return Promise.resolve('changed');
		});
		const secondCommandPromise = executeTaskCommandHandler(event, createUpdateCommand('second')) as Promise<TaskStorageCommandResult>;

		await waitForQueuedWork();

		expect(executionOrder).toEqual([ 'command-first' ]);

		firstCommandDeferred.resolve(commandResult);

		await expect(storageChangePromise).resolves.toBe('changed');
		await expect(firstCommandPromise).resolves.toBe(commandResult);
		await expect(secondCommandPromise).resolves.toBe(commandResult);
		expect(executionOrder).toEqual([ 'command-first', 'storage-change', 'command-second' ]);
	});
});
