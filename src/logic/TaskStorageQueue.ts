import { STORAGE_CONFIG } from 'src/config/AppConfig';
import type { SpotStorageApi, StorageStatus, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

/**
 * What the task page needs to know about storage writes: the latest database status, and whether something the user
 * changed is still not stored. The message is kept until that change is actually written, never cleared by an
 * unrelated command that happened to succeed.
 */
export interface TaskStorageQueueState {
	status: StorageStatus | undefined;
	unsavedChangesMessage: string | undefined;
}

const IDLE_STATE: TaskStorageQueueState = {
	status: undefined,
	unsavedChangesMessage: undefined
};

const createUnsavedChangesMessage = (message: string): string => {
	return `Task storage update failed. ${message}`;
};

// Storage commands are written one at a time and in order, so a failed one can be retried without letting later ones overtake it
const queuedCommands: TaskStorageCommand[] = [];

let queueState: TaskStorageQueueState = IDLE_STATE;

// A command the database refused is never written, so its warning cannot be cleared by later commands succeeding
let droppedCommandMessage: string | undefined;

let isWriting = false;

let retryTimeout: ReturnType<typeof setTimeout> | undefined;

const stateSubscribers = new Set<() => void>();

const idleWaiters = new Set<() => void>();

const notifyStateSubscribers = (): void => {
	stateSubscribers.forEach((subscriber) => {
		subscriber();
	});
};

const setQueueState = (nextState: TaskStorageQueueState): void => {
	if(nextState.status === queueState.status && nextState.unsavedChangesMessage === queueState.unsavedChangesMessage) {
		return;
	}

	queueState = nextState;
	notifyStateSubscribers();
};

const releaseIdleWaiters = (): void => {
	const waiters = Array.from(idleWaiters);

	idleWaiters.clear();
	waiters.forEach((waiter) => {
		waiter();
	});
};

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
};

// A database that failed once can work again, so those writes are kept and retried. Storage that refused a command because it is closing
// never even attempted it, so that command is kept too. A command the database refused as invalid would fail again in exactly the same
// way, so it is dropped and only reported.
const isRetryableFailure = (result: TaskStorageCommandResult): boolean => {
	return !result.ok && (result.reason === 'database-error' || result.reason === 'shutdown');
};

const writeCommand = async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
	const spotStorage = window.spotStorage as SpotStorageApi | undefined;

	if(!spotStorage) {
		return {
			ok: false,
			reason: 'not-implemented',
			message: 'SPOT must be opened from the Electron app.',
			status: {
				database: {
					state: 'unavailable'
				}
			}
		};
	}

	try {
		return await spotStorage.executeTaskCommand(command);
	}
	catch(error) {
		return {
			ok: false,
			reason: 'database-error',
			message: getErrorMessage(error),
			status: {
				database: {
					state: 'unavailable',
					message: getErrorMessage(error)
				}
			}
		};
	}
};

const scheduleRetry = (retryWrites: () => void): void => {
	if(retryTimeout) {
		return;
	}

	retryTimeout = setTimeout(() => {
		retryTimeout = undefined;
		retryWrites();
	}, STORAGE_CONFIG.writeRetryDelayMs);
};

const writeQueuedCommands = async(): Promise<void> => {
	if(isWriting) {
		return;
	}

	isWriting = true;

	try {
		while(queuedCommands.length > 0) {
			const result = await writeCommand(queuedCommands[0]);

			if(!result.ok) {
				setQueueState({
					status: result.status,
					unsavedChangesMessage: createUnsavedChangesMessage(result.message)
				});

				// The command stays at the front of the queue, so nothing written later can overtake it
				if(isRetryableFailure(result)) {
					scheduleRetry(() => {
						void writeQueuedCommands();
					});

					return;
				}

				droppedCommandMessage = createUnsavedChangesMessage(result.message);
				queuedCommands.shift();

				continue;
			}

			queuedCommands.shift();
			setQueueState({
				status: result.status,
				unsavedChangesMessage: queueState.unsavedChangesMessage
			});
		}

		// Everything still writable is stored, so only a warning about a command that will never be written survives
		setQueueState({
			status: queueState.status,
			unsavedChangesMessage: droppedCommandMessage
		});
		releaseIdleWaiters();
	}
	finally {
		isWriting = false;
	}
};

/**
 * Queues a storage command to be written.
 * @param command Storage command to write.
 */
export const sendTaskStorageCommand = (command: TaskStorageCommand): void => {
	queuedCommands.push(command);

	if(!retryTimeout) {
		void writeQueuedCommands();
	}
};

/**
 * Subscribes to the storage write state.
 * @param subscriber Callback invoked whenever the state changes.
 * @returns The callback that unsubscribes.
 */
export const subscribeToTaskStorageQueue = (subscriber: () => void): () => void => {
	stateSubscribers.add(subscriber);

	return () => {
		stateSubscribers.delete(subscriber);
	};
};

/**
 * Returns the latest storage write state.
 * @returns The database status and the message about changes that are not stored.
 */
export const getTaskStorageQueueState = (): TaskStorageQueueState => {
	return queueState;
};

/**
 * Writes the queued commands right away instead of waiting out the delay a failed write is retried after.
 * Used when the renderer is asked to save everything under a bounded time, which the retry delay alone could use up.
 */
export const retryTaskStorageQueueNow = (): void => {
	if(!retryTimeout) {
		return;
	}

	clearTimeout(retryTimeout);
	retryTimeout = undefined;
	void writeQueuedCommands();
};

/**
 * Waits until every queued command is written.
 * A command that keeps failing keeps the queue busy, so callers that cannot wait forever must bound the wait themselves.
 * @returns A promise that resolves when nothing is left to write.
 */
export const waitForTaskStorageQueue = (): Promise<void> => {
	if(queuedCommands.length === 0 && !isWriting) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		idleWaiters.add(resolve);
	});
};

/**
 * Forgets the warnings about changes that were not stored.
 * Used when tasks are loaded again from the database, because the task state does not hold those changes anymore.
 */
export const clearTaskStorageFailures = (): void => {
	droppedCommandMessage = undefined;
	setQueueState({
		status: queueState.status,
		unsavedChangesMessage: undefined
	});
};

/**
 * Drops every queued command and resets the state.
 * Only meant for tests, because the queue is shared by the whole renderer.
 */
export const resetTaskStorageQueueForTests = (): void => {
	if(retryTimeout) {
		clearTimeout(retryTimeout);
		retryTimeout = undefined;
	}

	queuedCommands.length = 0;
	queueState = IDLE_STATE;
	droppedCommandMessage = undefined;
	isWriting = false;
	idleWaiters.clear();
	stateSubscribers.clear();
};
