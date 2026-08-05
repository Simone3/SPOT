import { SHUTDOWN_CONFIG, TASKS_CONFIG } from 'src/config/AppConfig';
import { retryTaskStorageQueueNow, waitForTaskStorageQueue } from 'src/logic/TaskStorageQueue';
import type { SpotStorageApi } from 'src/types/TaskStorageTypes';
import type { Task, TaskChange } from 'src/types/TaskTypes';

/**
 * When a buffered value has to reach the task state.
 * "immediate" saves it right away and "delayed" restarts the save delay, while "buffered" only keeps it in the buffer: a value the
 * user is still typing is saved by the next save, by leaving the input, or by the flush that runs before the renderer goes away.
 */
export type TaskChangeFlushMode = 'immediate' | 'delayed' | 'buffered';

type PendingTaskChangesApplier = (taskId: string, change: TaskChange) => void;

type PendingTaskValueUpdater<TKey extends keyof Task> = (previousValue: Task[TKey]) => Task[TKey];

// Buffered task changes, kept out of the task components so that they survive re-renders, filtering and unmounts
const pendingTaskChanges = new Map<string, TaskChange>();

const flushTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const changeSubscribers = new Map<string, Set<() => void>>();

let applyPendingTaskChanges: PendingTaskChangesApplier | undefined;

const notifyChangeSubscribers = (taskId: string): void => {
	changeSubscribers.get(taskId)?.forEach((subscriber) => {
		subscriber();
	});
};

const clearFlushTimeout = (taskId: string): void => {
	const flushTimeout = flushTimeouts.get(taskId);

	if(flushTimeout) {
		clearTimeout(flushTimeout);
		flushTimeouts.delete(taskId);
	}
};

// The buffer is replaced instead of mutated, so that subscribers can compare snapshots by reference
const setPendingTaskChanges = (taskId: string, change: TaskChange): void => {
	if(Object.keys(change).length !== 0) {
		pendingTaskChanges.set(taskId, change);
	}
	else {
		pendingTaskChanges.delete(taskId);
	}

	notifyChangeSubscribers(taskId);
};

// Puts back what a failed save took out of the buffer. Anything buffered in the meantime is newer than the values that were
// being saved, so it wins field by field.
const restorePendingTaskChanges = (taskId: string, flushedChange: TaskChange): void => {
	setPendingTaskChanges(taskId, {
		...flushedChange,
		...pendingTaskChanges.get(taskId)
	});
};

/**
 * Saves the buffered changes of one task.
 * @param taskId Task to save.
 */
export const flushPendingTaskChangesForTask = (taskId: string): void => {
	const change = pendingTaskChanges.get(taskId);

	// Buffered changes are never dropped when there is nobody to apply them: they stay buffered until there is
	if(!change || !applyPendingTaskChanges) {
		return;
	}

	clearFlushTimeout(taskId);
	setPendingTaskChanges(taskId, {});
	try {
		applyPendingTaskChanges(taskId, change);
	}
	catch(error) {
		// An applier that threw saved nothing, and the buffer is the only place those values still exist: leaving them out of it
		// would lose them from the buffer and from the task state at once
		restorePendingTaskChanges(taskId, change);

		throw error;
	}
};

// A pending state change fades the task out before it moves to the other list, so it is saved on the shorter delay
const getFlushDelayMs = (task: Task, change: TaskChange): number => {
	return change.state !== undefined && change.state !== task.state ? TASKS_CONFIG.stateChangeDelayMs : TASKS_CONFIG.flushDelayMs;
};

const restartFlushTimeout = (task: Task, change: TaskChange): void => {
	clearFlushTimeout(task.id);

	if(Object.keys(change).length === 0) {
		return;
	}

	flushTimeouts.set(task.id, setTimeout(() => {
		flushPendingTaskChangesForTask(task.id);
	}, getFlushDelayMs(task, change)));
};

/**
 * Registers the callback that applies buffered task changes to the task state.
 * @param applier Callback that applies and persists buffered task changes.
 * @returns The callback that unregisters the applier.
 */
export const registerPendingTaskChangesApplier = (applier: PendingTaskChangesApplier): () => void => {
	applyPendingTaskChanges = applier;

	return () => {
		if(applyPendingTaskChanges === applier) {
			applyPendingTaskChanges = undefined;
		}
	};
};

/**
 * Subscribes to the buffered changes of one task.
 * @param taskId Task to observe.
 * @param subscriber Callback invoked whenever the buffered changes of the task change.
 * @returns The callback that unsubscribes.
 */
export const subscribeToPendingTaskChanges = (taskId: string, subscriber: () => void): () => void => {
	const taskSubscribers = changeSubscribers.get(taskId) ?? new Set<() => void>();

	taskSubscribers.add(subscriber);
	changeSubscribers.set(taskId, taskSubscribers);

	return () => {
		taskSubscribers.delete(subscriber);

		if(taskSubscribers.size === 0) {
			changeSubscribers.delete(taskId);
		}
	};
};

/**
 * Tells whether any task still has values waiting to be saved.
 * @returns Whether something is still buffered.
 */
export const hasPendingTaskChanges = (): boolean => {
	return pendingTaskChanges.size !== 0;
};

/**
 * Returns the buffered changes of one task.
 * The returned object is replaced only when the buffered changes change, so it can be used as a render snapshot.
 * @param taskId Task to read.
 * @returns The buffered changes, or undefined when the task has none.
 */
export const getPendingTaskChanges = (taskId: string): TaskChange | undefined => {
	return pendingTaskChanges.get(taskId);
};

/**
 * Buffers a new value for one task field, and saves it right away, after the save delay, or not at all.
 * @param task Task as it is in the task state.
 * @param key Task field to change.
 * @param valueOrUpdater New field value, or a callback that receives the currently buffered value.
 * @param flushMode When the buffered changes must be saved.
 */
export const changePendingTaskValue = <TKey extends keyof Task>(
	task: Task,
	key: TKey,
	valueOrUpdater: Task[TKey] | PendingTaskValueUpdater<TKey>,
	flushMode: TaskChangeFlushMode
): void => {
	const currentChange = pendingTaskChanges.get(task.id) ?? {};

	// The buffered value is the one the user last typed, so an updater must continue from it and not from the task state
	const currentValue = (Object.prototype.hasOwnProperty.call(currentChange, key) ? currentChange[key] : task[key]) as Task[TKey];
	const newValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(currentValue) : valueOrUpdater;
	const change: TaskChange = { ...currentChange };

	// A value brought back to what the task state already holds is not a change anymore
	if(newValue === task[key]) {
		delete change[key];
	}
	else {
		change[key] = newValue;
	}

	setPendingTaskChanges(task.id, change);

	if(flushMode === 'immediate') {
		flushPendingTaskChangesForTask(task.id);
	}
	else if(flushMode === 'delayed') {
		restartFlushTimeout(task, change);
	}

	// A buffered change waits for something else to save it, so it neither starts nor postpones a save of its own
};

/**
 * Drops the buffered changes of one task, without saving them.
 * @param taskId Task to clear.
 */
export const clearPendingTaskChanges = (taskId: string): void => {
	clearFlushTimeout(taskId);

	if(pendingTaskChanges.delete(taskId)) {
		notifyChangeSubscribers(taskId);
	}
};

/**
 * Saves the buffered changes of every task, including the tags the user is still typing into their tag inputs.
 * Used when the renderer is going away and nothing else will save them, so one task that cannot be saved never keeps the
 * other tasks from being saved and the caller is not left with a half-done flush to handle.
 */
export const flushPendingTaskChanges = (): void => {
	Array.from(pendingTaskChanges.keys()).forEach((taskId) => {
		try {
			flushPendingTaskChangesForTask(taskId);
		}
		catch(error) {
			// There is nothing left to fall back on: the values stay buffered, and the failure is only reported
			console.error('Could not save the buffered changes of a task', taskId, error);
		}
	});
};

/**
 * Saves every buffered task change and answers the main-process request to do so before the application quits.
 * The same flush runs on page hide, because closing the window destroys the renderer without unmounting anything.
 * Without the Electron storage API only the page hide flush is installed.
 * @param spotStorage Storage API to subscribe to.
 * @returns The callback that uninstalls the handlers.
 */
export const installPendingTaskChangesFlushHandler = (spotStorage: SpotStorageApi | undefined = window.spotStorage): () => void => {
	const flushOnPageHide = (): void => {
		flushPendingTaskChanges();
	};

	window.addEventListener('pagehide', flushOnPageHide);

	// The window stays interactive until the main process is told the buffer reached storage, and that wait lasts seconds whenever a write
	// failed and is being retried. Flushing only once would lose everything typed while the queue was still busy, so the buffer is flushed
	// again after every wait, for a bounded number of rounds.
	const flushEverythingAndWaitForStorage = async(): Promise<void> => {
		for(let round = 0; round < SHUTDOWN_CONFIG.maximumRendererFlushRounds; round += 1) {
			flushPendingTaskChanges();

			// The main process waits for a bounded time, so a write that failed earlier is retried now instead of at the end of its retry delay
			retryTaskStorageQueueNow();

			await waitForTaskStorageQueue();

			if(!hasPendingTaskChanges()) {
				return;
			}
		}
	};

	const unsubscribeFromFlushRequests = spotStorage?.onFlushPendingTaskChanges?.(() => {
		void flushEverythingAndWaitForStorage().then(() => {
			return spotStorage.notifyPendingTaskChangesFlushed();
		}, () => {
			return spotStorage.notifyPendingTaskChangesFlushed();
		});
	});

	return () => {
		window.removeEventListener('pagehide', flushOnPageHide);
		unsubscribeFromFlushRequests?.();
	};
};

/**
 * Drops all buffered task changes and registrations.
 * Only meant for tests, because the buffer is shared by the whole renderer.
 */
export const resetPendingTaskChangesForTests = (): void => {
	Array.from(flushTimeouts.keys()).forEach((taskId) => {
		clearFlushTimeout(taskId);
	});
	pendingTaskChanges.clear();
	changeSubscribers.clear();
	applyPendingTaskChanges = undefined;
};
