import { STORAGE_CONFIG } from 'src/config/AppConfig';
import {
	clearTaskStorageFailures,
	getTaskStorageQueueState,
	resetTaskStorageQueueForTests,
	retryTaskStorageQueueNow,
	sendTaskStorageCommand,
	subscribeToTaskStorageQueue,
	waitForTaskStorageQueue
} from 'src/logic/TaskStorageQueue';
import type { SpotStorageApi, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

const healthyResult: TaskStorageCommandResult = {
	ok: true,
	status: {
		database: {
			state: 'healthy'
		}
	}
};

const createDatabaseFailure = (message: string): TaskStorageCommandResult => {
	return {
		ok: false,
		reason: 'database-error',
		message,
		status: {
			database: {
				state: 'unavailable',
				message
			}
		}
	};
};

const createInvalidCommandFailure = (message: string): TaskStorageCommandResult => {
	return {
		ok: false,
		reason: 'invalid-command',
		message,
		status: {
			database: {
				state: 'healthy'
			}
		}
	};
};

const createShutdownFailure = (message: string): TaskStorageCommandResult => {
	return {
		ok: false,
		reason: 'shutdown',
		message,
		status: {
			database: {
				state: 'unavailable',
				message
			}
		}
	};
};

const createUpdateCommand = (taskId: string, text: string): TaskStorageCommand => {
	return {
		command: 'task.update',
		payload: {
			taskId,
			change: {
				text
			}
		}
	};
};

const originalSpotStorage = window.spotStorage;

const setExecuteTaskCommand = (executeTaskCommand: SpotStorageApi['executeTaskCommand']): void => {
	Object.defineProperty(window, 'spotStorage', {
		configurable: true,
		writable: true,
		value: {
			loadTasks: jest.fn(),
			executeTaskCommand,
			getStorageStatus: jest.fn(),
			onFlushPendingTaskChanges: jest.fn(),
			notifyPendingTaskChangesFlushed: jest.fn()
		}
	});
};

const waitForQueuedWork = (): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};

describe('TaskStorageQueue', () => {
	afterEach(() => {
		resetTaskStorageQueueForTests();
		Object.defineProperty(window, 'spotStorage', {
			configurable: true,
			writable: true,
			value: originalSpotStorage
		});
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test('writes queued commands one at a time and in order', async() => {
		const writtenTaskIds: string[] = [];
		setExecuteTaskCommand(jest.fn(async(command: TaskStorageCommand) => {
			writtenTaskIds.push((command.payload as { taskId: string }).taskId);

			return healthyResult;
		}));

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		sendTaskStorageCommand(createUpdateCommand('second', 'Second'));
		sendTaskStorageCommand(createUpdateCommand('third', 'Third'));
		await waitForTaskStorageQueue();

		expect(writtenTaskIds).toEqual([ 'first', 'second', 'third' ]);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBeUndefined();
	});

	test('retries a failed write and keeps warning until it goes through', async() => {
		jest.useFakeTimers();
		const executeTaskCommand: jest.Mock<Promise<TaskStorageCommandResult>, []> = jest.fn(async() => {
			return executeTaskCommand.mock.calls.length === 1 ? createDatabaseFailure('Database is locked.') : healthyResult;
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		await Promise.resolve();
		await Promise.resolve();

		expect(executeTaskCommand).toHaveBeenCalledTimes(1);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBe('Task storage update failed. Database is locked.');

		jest.advanceTimersByTime(STORAGE_CONFIG.writeRetryDelayMs);
		jest.useRealTimers();
		await waitForTaskStorageQueue();

		expect(executeTaskCommand).toHaveBeenCalledTimes(2);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBeUndefined();
	});

	test('does not let later commands overtake a failed one', async() => {
		jest.useFakeTimers();
		const writtenTaskIds: string[] = [];
		const executeTaskCommand = jest.fn(async(command: TaskStorageCommand) => {
			const { taskId } = command.payload as { taskId: string };

			if(taskId === 'first' && executeTaskCommand.mock.calls.length === 1) {
				return createDatabaseFailure('Database is locked.');
			}

			writtenTaskIds.push(taskId);

			return healthyResult;
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		await Promise.resolve();
		await Promise.resolve();
		sendTaskStorageCommand(createUpdateCommand('second', 'Second'));
		await Promise.resolve();

		expect(writtenTaskIds).toEqual([]);

		jest.advanceTimersByTime(STORAGE_CONFIG.writeRetryDelayMs);
		jest.useRealTimers();
		await waitForTaskStorageQueue();

		expect(writtenTaskIds).toEqual([ 'first', 'second' ]);
	});

	test('retries a write that threw instead of answering', async() => {
		jest.useFakeTimers();
		const executeTaskCommand: jest.Mock<Promise<TaskStorageCommandResult>, []> = jest.fn(async() => {
			if(executeTaskCommand.mock.calls.length === 1) {
				throw new Error('The renderer lost the main process.');
			}

			return healthyResult;
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		await Promise.resolve();
		await Promise.resolve();

		expect(getTaskStorageQueueState().unsavedChangesMessage).toBe('Task storage update failed. The renderer lost the main process.');

		jest.advanceTimersByTime(STORAGE_CONFIG.writeRetryDelayMs);
		jest.useRealTimers();
		await waitForTaskStorageQueue();

		expect(executeTaskCommand).toHaveBeenCalledTimes(2);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBeUndefined();
	});

	test('keeps a command storage refused while closing instead of dropping it', async() => {
		jest.useFakeTimers();
		const executeTaskCommand: jest.Mock<Promise<TaskStorageCommandResult>, []> = jest.fn(async() => {
			return executeTaskCommand.mock.calls.length === 1 ? createShutdownFailure('Task storage is shutting down.') : healthyResult;
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		await Promise.resolve();
		await Promise.resolve();

		expect(getTaskStorageQueueState().unsavedChangesMessage).toBe('Task storage update failed. Task storage is shutting down.');

		jest.advanceTimersByTime(STORAGE_CONFIG.writeRetryDelayMs);
		jest.useRealTimers();
		await waitForTaskStorageQueue();

		expect(executeTaskCommand).toHaveBeenCalledTimes(2);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBeUndefined();
	});

	test('retries a failed write immediately when the retry delay cannot be waited out', async() => {
		jest.useFakeTimers();
		const executeTaskCommand: jest.Mock<Promise<TaskStorageCommandResult>, []> = jest.fn(async() => {
			return executeTaskCommand.mock.calls.length === 1 ? createDatabaseFailure('Database is locked.') : healthyResult;
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		await Promise.resolve();
		await Promise.resolve();

		expect(executeTaskCommand).toHaveBeenCalledTimes(1);

		retryTaskStorageQueueNow();
		jest.useRealTimers();
		await waitForTaskStorageQueue();

		expect(executeTaskCommand).toHaveBeenCalledTimes(2);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBeUndefined();
	});

	test('drops a command the database refused instead of retrying it forever', async() => {
		const executeTaskCommand: jest.Mock<Promise<TaskStorageCommandResult>, []> = jest.fn(async() => {
			return createInvalidCommandFailure('Task field "id" cannot be changed.');
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		await waitForTaskStorageQueue();

		expect(executeTaskCommand).toHaveBeenCalledTimes(1);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBe('Task storage update failed. Task field "id" cannot be changed.');
	});

	test('gives up on a write the database keeps failing so later commands are still written', async() => {
		jest.useFakeTimers();
		const writtenTaskIds: string[] = [];
		const executeTaskCommand = jest.fn(async(command: TaskStorageCommand) => {
			const { taskId } = command.payload as { taskId: string };

			if(taskId === 'first') {
				return createDatabaseFailure('Disk is full.');
			}

			writtenTaskIds.push(taskId);

			return healthyResult;
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		sendTaskStorageCommand(createUpdateCommand('second', 'Second'));

		for(let attempt = 1; attempt < STORAGE_CONFIG.maximumWriteAttempts; attempt++) {
			await Promise.resolve();
			await Promise.resolve();

			expect(executeTaskCommand).toHaveBeenCalledTimes(attempt);
			expect(writtenTaskIds).toEqual([]);
			jest.advanceTimersByTime(STORAGE_CONFIG.writeRetryDelayMs);
		}

		jest.useRealTimers();
		await waitForTaskStorageQueue();

		// The change that cannot be written is given up on, so the queue stops holding back everything the user changed afterwards
		expect(executeTaskCommand).toHaveBeenCalledTimes(STORAGE_CONFIG.maximumWriteAttempts + 1);
		expect(writtenTaskIds).toEqual([ 'second' ]);
		expect(getTaskStorageQueueState().unsavedChangesMessage)
			.toBe(`Task storage update failed ${STORAGE_CONFIG.maximumWriteAttempts} times and was given up on, so that change is not stored. Disk is full.`);
	});

	test('does not count writes storage refused while closing against the retry limit', async() => {
		jest.useFakeTimers();
		const executeTaskCommand: jest.Mock<Promise<TaskStorageCommandResult>, []> = jest.fn(async() => {
			if(executeTaskCommand.mock.calls.length > STORAGE_CONFIG.maximumWriteAttempts * 2) {
				return healthyResult;
			}

			return createShutdownFailure('Task storage is shutting down.');
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));

		for(let attempt = 1; attempt <= STORAGE_CONFIG.maximumWriteAttempts * 2; attempt++) {
			await Promise.resolve();
			await Promise.resolve();

			expect(executeTaskCommand).toHaveBeenCalledTimes(attempt);
			jest.advanceTimersByTime(STORAGE_CONFIG.writeRetryDelayMs);
		}

		jest.useRealTimers();
		await waitForTaskStorageQueue();

		expect(executeTaskCommand).toHaveBeenCalledTimes(STORAGE_CONFIG.maximumWriteAttempts * 2 + 1);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBeUndefined();
	});

	test('keeps warning about a dropped command even after later commands succeed', async() => {
		const executeTaskCommand: jest.Mock<Promise<TaskStorageCommandResult>, []> = jest.fn(async() => {
			return executeTaskCommand.mock.calls.length === 1 ? createInvalidCommandFailure('Refused.') : healthyResult;
		});
		setExecuteTaskCommand(executeTaskCommand);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		await waitForTaskStorageQueue();
		sendTaskStorageCommand(createUpdateCommand('second', 'Second'));
		await waitForTaskStorageQueue();

		expect(executeTaskCommand).toHaveBeenCalledTimes(2);
		expect(getTaskStorageQueueState().unsavedChangesMessage).toBe('Task storage update failed. Refused.');

		// Tasks reloaded from the database replace the task state, so the warning about the old one no longer applies
		clearTaskStorageFailures();

		expect(getTaskStorageQueueState().unsavedChangesMessage).toBeUndefined();
	});

	test('reports the latest database status to its subscribers', async() => {
		const subscriber = jest.fn();
		setExecuteTaskCommand(jest.fn(async() => {
			return createDatabaseFailure('Database is locked.');
		}));
		const unsubscribe = subscribeToTaskStorageQueue(subscriber);

		sendTaskStorageCommand(createUpdateCommand('first', 'First'));
		await waitForQueuedWork();

		expect(subscriber).toHaveBeenCalled();
		expect(getTaskStorageQueueState().status?.database).toEqual({
			state: 'unavailable',
			message: 'Database is locked.'
		});

		unsubscribe();
	});

	test('resolves the idle wait right away when there is nothing to write', async() => {
		await expect(waitForTaskStorageQueue()).resolves.toBeUndefined();
	});
});
