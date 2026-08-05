import type { Mock } from 'vitest';
import type { App, IpcMain, IpcMainInvokeEvent } from 'electron';
import { makeTask } from '../testUtils';
import { SHUTDOWN_CONFIG } from 'src/config/AppConfig';
import { appLogger, resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
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
		handle: vi.fn((channel: string, handler: RegisteredIpcHandler) => {
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
		on: vi.fn((eventName: string, handler: RegisteredAppHandler) => {
			handlers.set(eventName, handler);
			return undefined;
		}),
		quit: vi.fn()
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
		loadTasks: vi.fn(async() => {
			return loadTasksResult;
		}),
		executeTaskCommand: vi.fn(async() => {
			return commandResult;
		}),
		getStorageStatus: vi.fn(async() => {
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
		vi.useRealTimers();
		vi.restoreAllMocks();
		resetAppLoggerForTests();
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

		expect(ipcMain.handle).toHaveBeenCalledTimes(4);
		expect(Array.from(handlers.keys())).toEqual([
			SPOT_STORAGE_IPC_CHANNELS.loadTasks,
			SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand,
			SPOT_STORAGE_IPC_CHANNELS.getStorageStatus,
			SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed
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
		taskStorage.executeTaskCommand = vi.fn(() => {
			return commandDeferred.promise;
		});
		const prepareForShutdown = vi.fn(async() => {
			return undefined;
		});
		const flushLogger = vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);
		const event = {} as IpcMainInvokeEvent;
		const beforeQuitEvent = {
			preventDefault: vi.fn()
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
			preventDefault: vi.fn()
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
	test('saves the task changes still buffered in the renderer before closing the database', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { commandResult, taskStorage } = createMockTaskStorage();
		const shutdownOrder: string[] = [];
		taskStorage.executeTaskCommand = vi.fn(async() => {
			shutdownOrder.push('buffered-command');

			return commandResult;
		});
		const prepareForShutdown = vi.fn(async() => {
			shutdownOrder.push('prepare-for-shutdown');

			return undefined;
		});
		vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);
		const flushTarget = {
			send: vi.fn(),
			isDestroyed: () => {
				return false;
			}
		};
		const event = {} as IpcMainInvokeEvent;
		const beforeQuitEvent = {
			preventDefault: vi.fn()
		};
		const bufferedCommand: TaskStorageCommand = {
			command: 'task.update',
			payload: {
				taskId: 'stored-task',
				change: {
					text: 'Typed right before quitting'
				}
			}
		};

		registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage: {
				...taskStorage,
				prepareForShutdown
			},
			getRendererFlushTarget: () => {
				return flushTarget;
			}
		});

		appHandlers.get('before-quit')!(beforeQuitEvent);

		expect(beforeQuitEvent.preventDefault).toHaveBeenCalledTimes(1);
		expect(flushTarget.send).toHaveBeenCalledWith(SPOT_STORAGE_IPC_CHANNELS.flushPendingTaskChanges);
		expect(prepareForShutdown).not.toHaveBeenCalled();

		// The renderer flushes what the user typed and only then reports that it is done
		await expect(handlers.get(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand)!(event, bufferedCommand)).resolves.toBe(commandResult);
		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);
		await waitForQueuedWork();

		expect(shutdownOrder).toEqual([ 'buffered-command', 'prepare-for-shutdown' ]);
		expect(app.quit).toHaveBeenCalledTimes(1);
	});

	test('refuses task commands once the renderer reported its buffered changes', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { status, taskStorage } = createMockTaskStorage();
		vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);
		const flushTarget = {
			send: vi.fn()
		};
		const event = {} as IpcMainInvokeEvent;
		const command: TaskStorageCommand = {
			command: 'task.update',
			payload: {
				taskId: 'stored-task',
				change: {
					text: 'Too late'
				}
			}
		};

		registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage,
			getRendererFlushTarget: () => {
				return flushTarget;
			}
		});

		appHandlers.get('before-quit')!({ preventDefault: vi.fn() });
		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);
		await waitForQueuedWork();

		await expect(handlers.get(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand)!(event, command)).resolves.toEqual({
			ok: false,
			reason: 'shutdown',
			message: TASK_STORAGE_SHUTDOWN_MESSAGE,
			status
		});
		expect(taskStorage.executeTaskCommand).not.toHaveBeenCalled();
	});

	test('takes the changes away from the application before it refuses the first command', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { taskStorage } = createMockTaskStorage();
		const shutdownOrder: string[] = [];
		const prepareForShutdown = vi.fn(async() => {
			shutdownOrder.push('prepare-for-shutdown');

			return undefined;
		});
		const onRendererFlushCompleted = vi.fn(() => {
			shutdownOrder.push('renderer-flush-completed');
		});
		vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);
		const flushTarget = {
			send: vi.fn()
		};
		const event = {} as IpcMainInvokeEvent;

		registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage: {
				...taskStorage,
				prepareForShutdown
			},
			getRendererFlushTarget: () => {
				return flushTarget;
			},
			onRendererFlushCompleted
		});

		appHandlers.get('before-quit')!({ preventDefault: vi.fn() });

		// The renderer is still saving what it buffered, so nothing has been taken away from it yet
		expect(shutdownOrder).toEqual([]);

		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);
		await waitForQueuedWork();

		// Draining, backing up and closing the database takes seconds, and every change made in the meantime would be refused
		expect(shutdownOrder).toEqual([ 'renderer-flush-completed', 'prepare-for-shutdown' ]);
		expect(onRendererFlushCompleted).toHaveBeenCalledTimes(1);
	});

	test('takes the changes away from the application right away when there is no renderer to ask', async() => {
		const { ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { taskStorage } = createMockTaskStorage();
		const onRendererFlushCompleted = vi.fn();
		vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);

		registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage,
			onRendererFlushCompleted
		});

		appHandlers.get('before-quit')!({ preventDefault: vi.fn() });
		await waitForQueuedWork();

		expect(onRendererFlushCompleted).toHaveBeenCalledTimes(1);
	});

	test('saves the task changes still buffered in the renderer before the window closes', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app } = createMockApp();
		const { commandResult, taskStorage } = createMockTaskStorage();
		const prepareForShutdown = vi.fn(async() => {
			return undefined;
		});
		const flushTarget = {
			send: vi.fn(),
			isDestroyed: () => {
				return false;
			}
		};
		const event = {} as IpcMainInvokeEvent;
		const bufferedCommand: TaskStorageCommand = {
			command: 'task.update',
			payload: {
				taskId: 'stored-task',
				change: {
					text: 'Typed right before closing the window'
				}
			}
		};
		let isWindowClosed = false;

		const { requestRendererFlushBeforeWindowClose } = registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage: {
				...taskStorage,
				prepareForShutdown
			},
			getRendererFlushTarget: () => {
				return flushTarget;
			}
		});

		const windowClosePromise = requestRendererFlushBeforeWindowClose()!.then(() => {
			isWindowClosed = true;
		});

		expect(flushTarget.send).toHaveBeenCalledWith(SPOT_STORAGE_IPC_CHANNELS.flushPendingTaskChanges);

		// The window is still there while the renderer flushes what the user typed, so the commands it sends are executed
		await expect(handlers.get(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand)!(event, bufferedCommand)).resolves.toBe(commandResult);
		expect(isWindowClosed).toBe(false);

		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);
		await windowClosePromise;

		expect(taskStorage.executeTaskCommand).toHaveBeenCalledWith(bufferedCommand);

		// Closing the window is not quitting: the database stays open, because the application may still be running
		expect(prepareForShutdown).not.toHaveBeenCalled();
		expect(app.quit).not.toHaveBeenCalled();
	});

	test('waits for the quit flush when the window is closed while it is still running', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { taskStorage } = createMockTaskStorage();
		vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);
		const flushTarget = {
			send: vi.fn()
		};
		const event = {} as IpcMainInvokeEvent;

		const { requestRendererFlushBeforeWindowClose } = registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage,
			getRendererFlushTarget: () => {
				return flushTarget;
			}
		});

		appHandlers.get('before-quit')!({ preventDefault: vi.fn() });

		// Destroying the window now would tear the renderer down halfway through the flush the quit is waiting for, so the close
		// joins that handshake instead of asking for a second one
		const windowClosePromise = requestRendererFlushBeforeWindowClose();

		expect(windowClosePromise).toBeDefined();
		expect(flushTarget.send).toHaveBeenCalledTimes(1);

		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);

		await expect(windowClosePromise).resolves.toBeUndefined();
	});

	test('closes the window right away once the quit flush is done', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { taskStorage } = createMockTaskStorage();
		vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);
		const flushTarget = {
			send: vi.fn()
		};
		const event = {} as IpcMainInvokeEvent;

		const { requestRendererFlushBeforeWindowClose } = registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage,
			getRendererFlushTarget: () => {
				return flushTarget;
			}
		});

		appHandlers.get('before-quit')!({ preventDefault: vi.fn() });
		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);
		await waitForQueuedWork();

		// The renderer has nothing left to write, and the quit closes the database right after, so the window does not wait again
		expect(requestRendererFlushBeforeWindowClose()).toBeUndefined();
		expect(flushTarget.send).toHaveBeenCalledTimes(1);
	});

	test('asks the renderer once when the application quits while the window is closing', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { taskStorage } = createMockTaskStorage();
		const prepareForShutdown = vi.fn(async() => {
			return undefined;
		});
		vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);
		const flushTarget = {
			send: vi.fn()
		};
		const event = {} as IpcMainInvokeEvent;

		const { requestRendererFlushBeforeWindowClose } = registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage: {
				...taskStorage,
				prepareForShutdown
			},
			getRendererFlushTarget: () => {
				return flushTarget;
			}
		});

		const windowClosePromise = requestRendererFlushBeforeWindowClose()!;

		appHandlers.get('before-quit')!({ preventDefault: vi.fn() });

		expect(flushTarget.send).toHaveBeenCalledTimes(1);
		expect(prepareForShutdown).not.toHaveBeenCalled();

		// The single report the renderer sends releases the window close and the quit drain alike
		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);
		await windowClosePromise;
		await waitForQueuedWork();

		expect(prepareForShutdown).toHaveBeenCalledTimes(1);
		expect(app.quit).toHaveBeenCalledTimes(1);
	});

	test('asks the renderer again when a window is closed after the previous one', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { taskStorage } = createMockTaskStorage();
		const flushTarget = {
			send: vi.fn()
		};
		const event = {} as IpcMainInvokeEvent;

		const { requestRendererFlushBeforeWindowClose } = registerTaskStorageIpcHandlers({
			ipcMain,
			taskStorage,
			getRendererFlushTarget: () => {
				return flushTarget;
			}
		});

		const firstWindowClosePromise = requestRendererFlushBeforeWindowClose()!;

		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);
		await firstWindowClosePromise;

		// On macOS the application keeps running, so a window opened again later has to be flushed again when it closes
		const secondWindowClosePromise = requestRendererFlushBeforeWindowClose()!;

		expect(flushTarget.send).toHaveBeenCalledTimes(2);

		await handlers.get(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed)!(event);
		await expect(secondWindowClosePromise).resolves.toBeUndefined();
	});

	test('closes the window without waiting when the renderer is already gone', () => {
		const { ipcMain } = createMockIpcMain();
		const { taskStorage } = createMockTaskStorage();

		const { requestRendererFlushBeforeWindowClose } = registerTaskStorageIpcHandlers({
			ipcMain,
			taskStorage,
			getRendererFlushTarget: () => {
				return {
					send: vi.fn(),
					isDestroyed: () => {
						return true;
					}
				};
			}
		});

		expect(requestRendererFlushBeforeWindowClose()).toBeUndefined();
	});

	test('does not wait forever when the renderer never reports its buffered changes', async() => {
		vi.useFakeTimers();
		const { ipcMain } = createMockIpcMain();
		const { app, handlers: appHandlers } = createMockApp();
		const { taskStorage } = createMockTaskStorage();
		const prepareForShutdown = vi.fn(async() => {
			return undefined;
		});
		const quitDeferred = createDeferred<void>();
		(app.quit as Mock).mockImplementation(() => {
			quitDeferred.resolve();
		});
		vi.spyOn(appLogger, 'flush').mockResolvedValue(undefined);

		registerTaskStorageIpcHandlers({
			app,
			ipcMain,
			taskStorage: {
				...taskStorage,
				prepareForShutdown
			},
			getRendererFlushTarget: () => {
				return {
					send: vi.fn()
				};
			}
		});

		appHandlers.get('before-quit')!({ preventDefault: vi.fn() });

		expect(prepareForShutdown).not.toHaveBeenCalled();

		vi.advanceTimersByTime(SHUTDOWN_CONFIG.rendererFlushTimeoutMs);
		await quitDeferred.promise;

		expect(prepareForShutdown).toHaveBeenCalledTimes(1);
		expect(app.quit).toHaveBeenCalledTimes(1);
	});

	test('runs two storage folder changes one after the other, with no command in between', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { commandResult, taskStorage } = createMockTaskStorage();
		const executionOrder: string[] = [];
		const firstChangeDeferred = createDeferred<void>();
		taskStorage.executeTaskCommand = vi.fn(async() => {
			executionOrder.push('command');

			return commandResult;
		});
		const event = {} as IpcMainInvokeEvent;

		const { runExclusively } = registerTaskStorageIpcHandlers({
			ipcMain,
			taskStorage
		});

		const firstChangePromise = runExclusively(async() => {
			executionOrder.push('first-change-start');
			await firstChangeDeferred.promise;
			executionOrder.push('first-change-end');

			return 'first';
		});

		// Requested while the first one is still running, for instance by a second click on the folder actions
		const secondChangePromise = runExclusively(async() => {
			executionOrder.push('second-change-start');
			await waitForQueuedWork();
			executionOrder.push('second-change-end');

			return 'second';
		});
		const commandPromise = handlers.get(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand)!(event, {
			command: 'task.update',
			payload: {
				taskId: 'stored-task',
				change: {
					text: 'Written during the folder changes'
				}
			}
		} as TaskStorageCommand) as Promise<TaskStorageCommandResult>;

		await waitForQueuedWork();

		expect(executionOrder).toEqual([ 'first-change-start' ]);

		firstChangeDeferred.resolve();

		await expect(firstChangePromise).resolves.toBe('first');
		await expect(secondChangePromise).resolves.toBe('second');
		await expect(commandPromise).resolves.toBe(commandResult);
		expect(executionOrder).toEqual([
			'first-change-start',
			'first-change-end',
			'second-change-start',
			'second-change-end',
			'command'
		]);
	});

	test('finalizes in-flight task commands before a storage folder change and queues later commands', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const { commandResult, taskStorage } = createMockTaskStorage();
		const firstCommandDeferred = createDeferred<TaskStorageCommandResult>();
		const executionOrder: string[] = [];
		taskStorage.executeTaskCommand = vi.fn((command: TaskStorageCommand) => {
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
