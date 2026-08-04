import { makeTask } from '../testUtils';
import { TASKS_CONFIG } from 'src/config/AppConfig';
import {
	changePendingNewTag,
	changePendingTaskValue,
	clearPendingTaskChanges,
	flushPendingTaskChanges,
	flushPendingTaskChangesForTask,
	getPendingTaskChanges,
	installPendingTaskChangesFlushHandler,
	registerPendingTaskChangesApplier,
	resetPendingTaskChangesForTests,
	subscribeToPendingTaskChanges,
	type PendingTaskChanges
} from 'src/logic/PendingTaskChanges';
import { resetTaskStorageQueueForTests, sendTaskStorageCommand } from 'src/logic/TaskStorageQueue';
import type { SpotStorageApi, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

type AppliedChange = [ string, PendingTaskChanges ];

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

const registerApplier = (): jest.Mock<void, AppliedChange> => {
	const applier = jest.fn<void, AppliedChange>();

	registerPendingTaskChangesApplier(applier);

	return applier;
};

const createMockSpotStorage = (): {
	spotStorage: SpotStorageApi;
	requestFlush: () => void;
} => {
	const flushRequestListeners = new Set<() => void>();
	const spotStorage = {
		loadTasks: jest.fn(),
		executeTaskCommand: jest.fn(),
		getStorageStatus: jest.fn(),
		onFlushPendingTaskChanges: jest.fn((listener: () => void) => {
			flushRequestListeners.add(listener);

			return () => {
				flushRequestListeners.delete(listener);
			};
		}),
		notifyPendingTaskChangesFlushed: jest.fn(async() => {
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
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test('buffers changed values and saves them after the flush delay', () => {
		jest.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', false);

		expect(getPendingTaskChanges(task.id)).toEqual({
			change: {
				text: 'Edited task'
			},
			newTag: ''
		});
		expect(applier).not.toHaveBeenCalled();

		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs - 1);
		expect(applier).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Edited task'
			},
			newTag: ''
		});
		expect(getPendingTaskChanges(task.id)).toBeUndefined();
	});

	test('restarts the flush delay on every change and saves them together', () => {
		jest.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', false);
		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs - 1);
		changePendingTaskValue(task, 'owner', 'Alice', false);
		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs - 1);

		expect(applier).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);

		expect(applier).toHaveBeenCalledTimes(1);
		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Edited task',
				owner: 'Alice'
			},
			newTag: ''
		});
	});

	test('saves buffered changes immediately when asked to flush', () => {
		jest.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', false);
		flushPendingTaskChangesForTask(task.id);

		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Edited task'
			},
			newTag: ''
		});

		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).toHaveBeenCalledTimes(1);
	});

	test('forgets a value brought back to the one the task state already holds', () => {
		jest.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', false);
		changePendingTaskValue(task, 'text', 'Original task', false);

		expect(getPendingTaskChanges(task.id)).toBeUndefined();

		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).not.toHaveBeenCalled();
	});

	test('uses the shorter state change delay while the task fades out', () => {
		jest.useFakeTimers();
		const task = makeTask({ state: 'ACTIVE' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'state', 'COMPLETED', false);
		jest.advanceTimersByTime(TASKS_CONFIG.stateChangeDelayMs);

		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {
				state: 'COMPLETED'
			},
			newTag: ''
		});
	});

	test('gives the buffered value to the updater form', () => {
		const task = makeTask({ tags: [ 'work' ] });
		const applier = registerApplier();

		changePendingTaskValue(task, 'tags', (previousTags) => {
			return [ ...previousTags, 'urgent' ];
		}, false);
		changePendingTaskValue(task, 'tags', (previousTags) => {
			return [ ...previousTags, 'later' ];
		}, true);

		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {
				tags: [ 'work', 'urgent', 'later' ]
			},
			newTag: ''
		});
	});

	test('drops the buffered changes of a deleted task', () => {
		jest.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited and then deleted', false);
		clearPendingTaskChanges(task.id);

		expect(getPendingTaskChanges(task.id)).toBeUndefined();

		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).not.toHaveBeenCalled();
	});

	test('commits the trailing tag input only on the final flush', () => {
		jest.useFakeTimers();
		const task = makeTask();
		const applier = registerApplier();

		changePendingNewTag(task.id, 'half-typed');

		// The user may still be typing, so neither the delay nor a normal flush may steal it
		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);
		flushPendingTaskChangesForTask(task.id);

		expect(applier).not.toHaveBeenCalled();
		expect(getPendingTaskChanges(task.id)).toEqual({
			change: {},
			newTag: 'half-typed'
		});

		flushPendingTaskChanges();

		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {},
			newTag: 'half-typed'
		});
	});

	test('keeps the trailing tag input while the other buffered changes are saved', () => {
		jest.useFakeTimers();
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();

		changePendingTaskValue(task, 'text', 'Edited task', false);
		changePendingNewTag(task.id, 'half-typed');

		// The delayed save of the text must not take away the tag the user is still typing
		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);

		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Edited task'
			},
			newTag: ''
		});
		expect(getPendingTaskChanges(task.id)).toEqual({
			change: {},
			newTag: 'half-typed'
		});

		flushPendingTaskChanges();

		expect(applier).toHaveBeenLastCalledWith(task.id, {
			change: {},
			newTag: 'half-typed'
		});
		expect(getPendingTaskChanges(task.id)).toBeUndefined();
	});

	test('keeps buffered changes when there is nobody to apply them', () => {
		jest.useFakeTimers();
		const task = makeTask({ text: 'Original task' });

		changePendingTaskValue(task, 'text', 'Edited task', false);
		jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);
		flushPendingTaskChanges();

		expect(getPendingTaskChanges(task.id)).toEqual({
			change: {
				text: 'Edited task'
			},
			newTag: ''
		});

		const applier = registerApplier();
		flushPendingTaskChanges();

		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Edited task'
			},
			newTag: ''
		});
	});

	test('notifies the subscribers of one task only, with a stable snapshot', () => {
		const task = makeTask({ text: 'Original task' });
		const otherTask = makeTask({ text: 'Other task' });
		const subscriber = jest.fn();
		const otherSubscriber = jest.fn();
		registerApplier();
		const unsubscribe = subscribeToPendingTaskChanges(task.id, subscriber);
		subscribeToPendingTaskChanges(otherTask.id, otherSubscriber);

		const snapshotBeforeChange = getPendingTaskChanges(task.id);
		changePendingTaskValue(task, 'text', 'Edited task', false);

		expect(subscriber).toHaveBeenCalledTimes(1);
		expect(otherSubscriber).not.toHaveBeenCalled();
		expect(getPendingTaskChanges(task.id)).not.toBe(snapshotBeforeChange);
		expect(getPendingTaskChanges(task.id)).toBe(getPendingTaskChanges(task.id));

		unsubscribe();
		changePendingTaskValue(task, 'text', 'Edited again', false);

		expect(subscriber).toHaveBeenCalledTimes(1);
	});

	test('saves buffered changes when the page is hidden', () => {
		const task = makeTask({ text: 'Original task' });
		const applier = registerApplier();
		const uninstall = installPendingTaskChangesFlushHandler(undefined);

		changePendingTaskValue(task, 'text', 'Typed right before closing the window', false);
		window.dispatchEvent(new Event('pagehide'));

		expect(applier).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Typed right before closing the window'
			},
			newTag: ''
		});

		uninstall();
	});

	test('reports to the main process only after the buffered changes reached storage', async() => {
		const { spotStorage, requestFlush } = createMockSpotStorage();
		const task = makeTask({ text: 'Original task' });
		const commandDeferred = createDeferred<TaskStorageCommandResult>();
		setWindowSpotStorage({
			...spotStorage,
			executeTaskCommand: jest.fn(() => {
				return commandDeferred.promise;
			})
		});
		registerPendingTaskChangesApplier((taskId, pendingChanges) => {
			sendTaskStorageCommand({
				command: 'task.update',
				payload: {
					taskId,
					change: pendingChanges.change
				}
			});
		});
		const uninstall = installPendingTaskChangesFlushHandler(spotStorage);

		changePendingTaskValue(task, 'text', 'Typed right before quitting', false);
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

	test('installs the page hide flush without the Electron storage API', () => {
		const uninstall = installPendingTaskChangesFlushHandler(undefined);

		expect(typeof uninstall).toBe('function');

		uninstall();
	});
});
