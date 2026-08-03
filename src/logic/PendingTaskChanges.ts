import { TASKS_CONFIG } from 'src/config/AppConfig';
import { waitForTaskStorageQueue } from 'src/logic/TaskStorageQueue';
import type { SpotStorageApi } from 'src/types/TaskStorageTypes';
import type { Task, TaskChange } from 'src/types/TaskTypes';

/**
 * The task values the user changed but that did not reach the task state yet.
 * "newTag" is the content of the trailing tag input, which is not a task field until it is committed.
 */
export interface PendingTaskChanges {
	change: TaskChange;
	newTag: string;
}

type PendingTaskChangesApplier = (taskId: string, pendingChanges: PendingTaskChanges) => void;

type PendingTaskValueUpdater<TKey extends keyof Task> = (previousValue: Task[TKey]) => Task[TKey];

const EMPTY_NEW_TAG = '';

// Buffered task changes, kept out of the task components so that they survive re-renders, filtering and unmounts
const pendingTaskChanges = new Map<string, PendingTaskChanges>();

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

const hasBufferedValues = (pendingChanges: PendingTaskChanges): boolean => {
	return Object.keys(pendingChanges.change).length !== 0 || pendingChanges.newTag !== EMPTY_NEW_TAG;
};

// The buffer is replaced instead of mutated, so that subscribers can compare snapshots by reference
const setPendingTaskChanges = (taskId: string, pendingChanges: PendingTaskChanges): void => {
	if(hasBufferedValues(pendingChanges)) {
		pendingTaskChanges.set(taskId, pendingChanges);
	}
	else {
		pendingTaskChanges.delete(taskId);
	}

	notifyChangeSubscribers(taskId);
};

const flushTask = (taskId: string, commitNewTag: boolean): void => {
	const pendingChanges = pendingTaskChanges.get(taskId);

	// Buffered changes are never dropped when there is nobody to apply them: they stay buffered until there is
	if(!pendingChanges || !applyPendingTaskChanges) {
		return;
	}

	const newTag = commitNewTag ? pendingChanges.newTag.trim() : EMPTY_NEW_TAG;

	if(Object.keys(pendingChanges.change).length === 0 && !newTag) {
		return;
	}

	clearFlushTimeout(taskId);
	pendingTaskChanges.delete(taskId);
	notifyChangeSubscribers(taskId);
	applyPendingTaskChanges(taskId, {
		change: pendingChanges.change,
		newTag
	});
};

/**
 * Saves the buffered changes of one task.
 * The trailing tag input is left alone, because the user may still be typing in it.
 * @param taskId Task to save.
 */
export const flushPendingTaskChangesForTask = (taskId: string): void => {
	flushTask(taskId, false);
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
 * Returns the buffered changes of one task.
 * The returned object is replaced only when the buffered changes change, so it can be used as a render snapshot.
 * @param taskId Task to read.
 * @returns The buffered changes, or undefined when the task has none.
 */
export const getPendingTaskChanges = (taskId: string): PendingTaskChanges | undefined => {
	return pendingTaskChanges.get(taskId);
};

/**
 * Buffers a new value for one task field, and either saves it right away or restarts the save delay.
 * @param task Task as it is in the task state.
 * @param key Task field to change.
 * @param valueOrUpdater New field value, or a callback that receives the currently buffered value.
 * @param flush Whether the buffered changes must be saved immediately.
 */
export const changePendingTaskValue = <TKey extends keyof Task>(
	task: Task,
	key: TKey,
	valueOrUpdater: Task[TKey] | PendingTaskValueUpdater<TKey>,
	flush: boolean
): void => {
	const currentPendingChanges = pendingTaskChanges.get(task.id);
	const currentChange = currentPendingChanges?.change ?? {};

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

	setPendingTaskChanges(task.id, {
		change,
		newTag: currentPendingChanges?.newTag ?? EMPTY_NEW_TAG
	});

	if(flush) {
		flushPendingTaskChangesForTask(task.id);
	}
	else {
		restartFlushTimeout(task, change);
	}
};

/**
 * Buffers the content of the trailing tag input of one task.
 * It is not a task change until it is committed, so it does not start the save delay.
 * @param taskId Task to change.
 * @param newTag Content of the trailing tag input.
 */
export const changePendingNewTag = (taskId: string, newTag: string): void => {
	setPendingTaskChanges(taskId, {
		change: pendingTaskChanges.get(taskId)?.change ?? {},
		newTag
	});
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
 * Saves the buffered changes of every task, including the tags still sitting in the trailing tag inputs.
 * Used when the renderer is going away and nothing else will save them.
 */
export const flushPendingTaskChanges = (): void => {
	Array.from(pendingTaskChanges.keys()).forEach((taskId) => {
		flushTask(taskId, true);
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

	const unsubscribeFromFlushRequests = spotStorage?.onFlushPendingTaskChanges?.(() => {
		flushPendingTaskChanges();

		void waitForTaskStorageQueue().then(() => {
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
