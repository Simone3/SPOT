import type { Mock } from 'vitest';
import { makeTask } from '../testUtils';
import { TASKS_CONFIG } from 'src/config/AppConfig';
import {
	changePendingTaskValue,
	clearPendingTaskChanges,
	flushPendingTaskChanges,
	flushPendingTaskChangesForTask,
	getPendingTaskChanges,
	installPendingTaskChangesFlushHandler,
	registerPendingTaskChangesApplier,
	resetPendingTaskChangesForTests,
	subscribeToPendingTaskChanges
} from 'src/logic/PendingTaskChanges';
import { resetTaskStorageQueueForTests, sendTaskStorageCommand } from 'src/logic/TaskStorageQueue';
import type { SpotStorageApi, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';
import type { TaskChange } from 'src/types/TaskTypes';

type AppliedChange = [ string, TaskChange ];

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

const registerApplier = (): Mock<(...args: AppliedChange) => void> => {
	const applier = vi.fn<(...args: AppliedChange) => void>();

	registerPendingTaskChangesApplier(applier);

	return applier;
};

const createMockSpotStorage = (): {
	spotStorage: SpotStorageApi;
	requestFlush: () => void;
} => {
	const flushRequestListeners = new Set<() => void>();
	const spotStorage = {
		loadTasks: vi.fn(),
		executeTaskCommand: vi.fn(),
		getStorageStatus: vi.fn(),
		onFlushPendingTaskChanges: vi.fn((listener: () => void) => {
			flushRequestListeners.add(listener);

			return () => {
				flushRequestListeners.delete(listener);
			};
		}),
		notifyPendingTaskChangesFlushed: vi.fn(async() => {
			return undefined;
		})
	} as unknown as SpotStorageApi;

	return {
		spotStorage,
		requestFlush: () => {
			flushRequestListeners.forEach((listener) => {
				listener();
			});
		}
	};
};

const originalSpotStorage = window.spotStorage;

const setWindowSpotStorage = (spotStorage: SpotStorageApi | undefined): void => {
	Object.defineProperty(window, 'spotStorage', {
		configurable: true,
		writable: true,
		value: spotStorage
	});
};

describe('PendingTaskChanges', () => {
	afterEach(() => {
		resetPendingTaskChangesForTests();
		resetTaskStorageQueueForTests();
		setWindowSpotStorage(originalSpotStorage);
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	test('buffers changed values and saves them after the flush delay', () => {
		vi.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', 'delayed');

		expect(getPendingTaskChanges(task.id)).toEqual({
			text: 'Edited task'
		});
		expect(applier).not.toHaveBeenCalled();

		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs - 1);
		expect(applier).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(applier).toHaveBeenCalledWith(task.id, {
			text: 'Edited task'
		});
		expect(getPendingTaskChanges(task.id)).toBeUndefined();
	});

	test('restarts the flush delay on every change and saves them together', () => {
		vi.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', 'delayed');
		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs - 1);
		changePendingTaskValue(task, 'owner', 'Alice', 'delayed');
		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs - 1);

		expect(applier).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);

		expect(applier).toHaveBeenCalledTimes(1);
		expect(applier).toHaveBeenCalledWith(task.id, {
			text: 'Edited task',
			owner: 'Alice'
		});
	});

	test('saves buffered changes immediately when asked to flush', () => {
		vi.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', 'delayed');
		flushPendingTaskChangesForTask(task.id);

		expect(applier).toHaveBeenCalledWith(task.id, {
			text: 'Edited task'
		});

		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).toHaveBeenCalledTimes(1);
	});

	test('forgets a value brought back to the one the task state already holds', () => {
		vi.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', 'delayed');
		changePendingTaskValue(task, 'text', 'Original task', 'delayed');

		expect(getPendingTaskChanges(task.id)).toBeUndefined();

		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).not.toHaveBeenCalled();
	});

	test('uses the shorter state change delay while the task fades out', () => {
		vi.useFakeTimers();
		const task = makeTask({ state: 'ACTIVE' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'state', 'COMPLETED', 'delayed');
		vi.advanceTimersByTime(TASKS_CONFIG.stateChangeDelayMs);

		expect(applier).toHaveBeenCalledWith(task.id, {
			state: 'COMPLETED'
		});
	});

	test('gives the buffered value to the updater form', () => {
		const task = makeTask({ tags: [ 'work' ] });
		const applier = registerApplier();

		changePendingTaskValue(task, 'tags', (previousTags) => {
			return [ ...previousTags, 'urgent' ];
		}, 'buffered');
		changePendingTaskValue(task, 'tags', (previousTags) => {
			return [ ...previousTags, 'later' ];
		}, 'immediate');

		expect(applier).toHaveBeenCalledWith(task.id, {
			tags: [ 'work', 'urgent', 'later' ]
		});
	});

	test('drops the buffered changes of a deleted task', () => {
		vi.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited and then deleted', 'delayed');
		clearPendingTaskChanges(task.id);

		expect(getPendingTaskChanges(task.id)).toBeUndefined();

		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).not.toHaveBeenCalled();
	});

	test('does not save on its own a tag the user is still typing', () => {
		vi.useFakeTimers();
		const task = makeTask();
		const applier = registerApplier();

		changePendingTaskValue(task, 'tags', [ 'half-typed' ], 'buffered');

		// The user may still be typing, so a buffered value never starts a save delay of its own
		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).not.toHaveBeenCalled();
		expect(getPendingTaskChanges(task.id)).toEqual({
			tags: [ 'half-typed' ]
		});

		flushPendingTaskChanges();

		expect(applier).toHaveBeenCalledWith(task.id, {
			tags: [ 'half-typed' ]
		});
	});

	test('saves a buffered tag together with the change that was already waiting for its delay', () => {
		vi.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', 'delayed');
		changePendingTaskValue(task, 'tags', [ 'half-typed' ], 'buffered');

		// The buffered tag neither postpones nor cancels the save the text change already scheduled
		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).toHaveBeenCalledWith(task.id, {
			text: 'Edited task',
			tags: [ 'half-typed' ]
		});
		expect(getPendingTaskChanges(task.id)).toBeUndefined();
	});

	test('keeps buffered changes when there is nobody to apply them', () => {
		vi.useFakeTimers();
		const task = makeTask({ text: 'Original task' });

		changePendingTaskValue(task, 'text', 'Edited task', 'delayed');
		vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);
		flushPendingTaskChanges();

		expect(getPendingTaskChanges(task.id)).toEqual({
			text: 'Edited task'
		});

		const applier = registerApplier();
		flushPendingTaskChanges();

		expect(applier).toHaveBeenCalledWith(task.id, {
			text: 'Edited task'
		});
	});

	test('notifies the subscribers of one task only, with a stable snapshot', () => {
		const task = makeTask({ text: 'Original task' });
		const otherTask = makeTask({ text: 'Other task' });
		const subscriber = vi.fn();
		const otherSubscriber = vi.fn();
		registerApplier();
		const unsubscribe = subscribeToPendingTaskChanges(task.id, subscriber);
		subscribeToPendingTaskChanges(otherTask.id, otherSubscriber);

		const snapshotBeforeChange = getPendingTaskChanges(task.id);
		changePendingTaskValue(task, 'text', 'Edited task', 'delayed');

		expect(subscriber).toHaveBeenCalledTimes(1);
		expect(otherSubscriber).not.toHaveBeenCalled();
		expect(getPendingTaskChanges(task.id)).not.toBe(snapshotBeforeChange);
		expect(getPendingTaskChanges(task.id)).toBe(getPendingTaskChanges(task.id));

		unsubscribe();
		changePendingTaskValue(task, 'text', 'Edited again', 'delayed');

		expect(subscriber).toHaveBeenCalledTimes(1);
	});

	test('saves buffered changes when the page is hidden', () => {
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();
		const uninstall = installPendingTaskChangesFlushHandler(undefined);

		changePendingTaskValue(task, 'text', 'Typed right before closing the window', 'delayed');
		window.dispatchEvent(new Event('pagehide'));

		expect(applier).toHaveBeenCalledWith(task.id, {
			text: 'Typed right before closing the window'
		});

		uninstall();
	});

	test('keeps the buffered changes when the applier throws', () => {
		vi.useFakeTimers();
		const task = makeTask({ text: 'Original task' });

		vi.spyOn(console, 'error').mockImplementation(() => {});
		registerPendingTaskChangesApplier(() => {
			throw new Error('The task state could not be updated.');
		});
		changePendingTaskValue(task, 'text', 'Edited task', 'delayed');
		changePendingTaskValue(task, 'tags', [ 'urgent' ], 'buffered');

		// A single-task save still reports the failure to the caller, while the flush of the whole buffer keeps going through the other tasks
		expect(() => {
			flushPendingTaskChangesForTask(task.id);
		}).toThrow('The task state could not be updated.');
		expect(() => {
			flushPendingTaskChanges();
		}).not.toThrow();

		// A save that did not happen must leave the values where they still are, or they would be lost by the buffer and the task state at once
		expect(getPendingTaskChanges(task.id)).toEqual({
			text: 'Edited task',
			tags: [ 'urgent' ]
		});
	});

	test('saves the other tasks when one of them cannot be saved', () => {
		vi.useFakeTimers();
		const failingTask = makeTask({ text: 'First task' });
		const otherTask = makeTask({ text: 'Second task' });
		const appliedChanges: AppliedChange[] = [];

		vi.spyOn(console, 'error').mockImplementation(() => {});
		registerPendingTaskChangesApplier((taskId, changedValues) => {
			if(taskId === failingTask.id) {
				throw new Error('The task state could not be updated.');
			}

			appliedChanges.push([ taskId, changedValues ]);
		});
		changePendingTaskValue(failingTask, 'text', 'Typed right before closing the window', 'delayed');
		changePendingTaskValue(otherTask, 'text', 'Typed in the other task', 'delayed');
		changePendingTaskValue(otherTask, 'tags', [ 'urgent' ], 'buffered');
		flushPendingTaskChanges();

		expect(appliedChanges).toEqual([
			[ otherTask.id, {
				text: 'Typed in the other task',
				tags: [ 'urgent' ]
			} ]
		]);
		expect(getPendingTaskChanges(failingTask.id)).toEqual({
			text: 'Typed right before closing the window'
		});
		expect(getPendingTaskChanges(otherTask.id)).toBeUndefined();
	});

	test('reports to the main process only after the buffered changes reached storage', async() => {
		const { spotStorage, requestFlush } = createMockSpotStorage();
		const task = makeTask({ text: 'Original task' });
		const commandDeferred = createDeferred<TaskStorageCommandResult>();
		setWindowSpotStorage({
			...spotStorage,
			executeTaskCommand: vi.fn(() => {
				return commandDeferred.promise;
			})
		});
		registerPendingTaskChangesApplier((taskId, changedValues) => {
			sendTaskStorageCommand({
				command: 'task.update',
				payload: {
					taskId,
					change: changedValues
				}
			});
		});
		const uninstall = installPendingTaskChangesFlushHandler(spotStorage);

		changePendingTaskValue(task, 'text', 'Typed right before quitting', 'delayed');
		requestFlush();
		await waitForQueuedWork();

		expect(spotStorage.notifyPendingTaskChangesFlushed).not.toHaveBeenCalled();

		commandDeferred.resolve({
			ok: true,
			status: {
				database: {
					state: 'healthy'
				}
			}
		});
		await waitForQueuedWork();

		expect(spotStorage.notifyPendingTaskChangesFlushed).toHaveBeenCalledTimes(1);

		uninstall();
	});

	test('retries a write that failed as soon as the main process asks for the flush', async() => {
		vi.useFakeTimers();
		const { spotStorage, requestFlush } = createMockSpotStorage();
		const task = makeTask({ text: 'Original task' });
		const healthyResult: TaskStorageCommandResult = {
			ok: true,
			status: {
				database: {
					state: 'healthy'
				}
			}
		};
		const databaseFailure: TaskStorageCommandResult = {
			ok: false,
			reason: 'database-error',
			message: 'Database is locked.',
			status: {
				database: {
					state: 'unavailable',
					message: 'Database is locked.'
				}
			}
		};
		const executeTaskCommand: Mock<() => Promise<TaskStorageCommandResult>> = vi.fn(async() => {
			return executeTaskCommand.mock.calls.length === 1 ? databaseFailure : healthyResult;
		});
		setWindowSpotStorage({
			...spotStorage,
			executeTaskCommand
		});
		registerPendingTaskChangesApplier((taskId, changedValues) => {
			sendTaskStorageCommand({
				command: 'task.update',
				payload: {
					taskId,
					change: changedValues
				}
			});
		});
		const uninstall = installPendingTaskChangesFlushHandler(spotStorage);

		changePendingTaskValue(task, 'text', 'Typed while the database was down', 'immediate');
		await Promise.resolve();
		await Promise.resolve();

		expect(executeTaskCommand).toHaveBeenCalledTimes(1);

		// The write is sitting on its retry delay, which is longer than the time the main process waits for the flush
		requestFlush();
		vi.useRealTimers();
		await waitForQueuedWork();

		expect(executeTaskCommand).toHaveBeenCalledTimes(2);
		expect(spotStorage.notifyPendingTaskChangesFlushed).toHaveBeenCalledTimes(1);

		uninstall();
	});

	test('saves what the user typed while the queued writes were still being drained', async() => {
		const { spotStorage, requestFlush } = createMockSpotStorage();
		const task = makeTask({ text: 'Original task' });
		const healthyResult: TaskStorageCommandResult = {
			ok: true,
			status: {
				database: {
					state: 'healthy'
				}
			}
		};
		const firstWriteDeferred = createDeferred<TaskStorageCommandResult>();
		const executeTaskCommand: Mock<() => Promise<TaskStorageCommandResult>> = vi.fn(() => {
			return executeTaskCommand.mock.calls.length === 1 ? firstWriteDeferred.promise : Promise.resolve(healthyResult);
		});
		setWindowSpotStorage({
			...spotStorage,
			executeTaskCommand
		});
		const applier = vi.fn<(...args: AppliedChange) => void>((taskId, changedValues) => {
			sendTaskStorageCommand({
				command: 'task.update',
				payload: {
					taskId,
					change: changedValues
				}
			});
		});
		registerPendingTaskChangesApplier(applier);
		const uninstall = installPendingTaskChangesFlushHandler(spotStorage);

		changePendingTaskValue(task, 'text', 'Typed before quitting', 'delayed');
		requestFlush();
		await waitForQueuedWork();

		// The window is still there while the first write is in flight, so the user can keep typing into it
		changePendingTaskValue(task, 'text', 'Typed while quitting', 'delayed');
		expect(spotStorage.notifyPendingTaskChangesFlushed).not.toHaveBeenCalled();

		firstWriteDeferred.resolve(healthyResult);
		await waitForQueuedWork();

		expect(applier).toHaveBeenNthCalledWith(2, task.id, {
			text: 'Typed while quitting'
		});
		expect(executeTaskCommand).toHaveBeenCalledTimes(2);
		expect(spotStorage.notifyPendingTaskChangesFlushed).toHaveBeenCalledTimes(1);

		uninstall();
	});

	test('reports the flush as done even when something stays buffered for good', async() => {
		const { spotStorage, requestFlush } = createMockSpotStorage();
		const task = makeTask({ text: 'Original task' });
		const reportedErrors = vi.spyOn(console, 'error').mockImplementation(() => {});
		setWindowSpotStorage(spotStorage);
		const uninstall = installPendingTaskChangesFlushHandler(spotStorage);

		// Nothing applies the buffered changes, so they stay buffered no matter how many times they are flushed
		changePendingTaskValue(task, 'text', 'Never applied', 'delayed');
		requestFlush();
		await waitForQueuedWork();

		expect(spotStorage.notifyPendingTaskChangesFlushed).toHaveBeenCalledTimes(1);
		expect(getPendingTaskChanges(task.id)).toEqual({
			text: 'Never applied'
		});

		// Those values go away with the renderer, so giving up on them is never silent
		expect(reportedErrors).toHaveBeenCalledWith(expect.any(String), [ task.id ]);

		uninstall();
	});

	test('installs the page hide flush without the Electron storage API', () => {
		const uninstall = installPendingTaskChangesFlushHandler(undefined);

		expect(typeof uninstall).toBe('function');

		uninstall();
	});
});
