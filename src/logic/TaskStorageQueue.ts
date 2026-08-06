import { I18N_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { createStorageQueue, type StorageQueueState } from 'src/framework/renderer/StorageQueue';
import { createSpotTranslator, type SpotTranslator } from 'src/i18n/Translations';
import type { SpotStorageApi, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

export type TaskStorageQueueState = StorageQueueState;

// The queue is created once for the whole renderer, before anything has mounted, but its messages are only worded when a write
// actually fails. It therefore starts on the default language and is handed the real translator as soon as React knows it.
let queueTranslator: SpotTranslator = createSpotTranslator(I18N_CONFIG.defaultLanguage);

/**
 * Tells the queue which language to word its failures in.
 * Messages already produced keep the wording they were produced with, because they describe something that happened then.
 * @param translator Translator for the current language.
 */
export const setTaskStorageQueueTranslator = (translator: SpotTranslator): void => {
	queueTranslator = translator;
};

const createUnsavedChangesMessage = (message: string): string => {
	return queueTranslator.t('storage.updateFailed', { message });
};

const createAbandonedChangeMessage = (message: string): string => {
	return queueTranslator.t('storage.updateAbandoned', {
		attempts: STORAGE_CONFIG.maximumWriteAttempts,
		message
	});
};

const sendTaskCommandToMainProcess = (command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
	const spotStorage = window.spotStorage as SpotStorageApi | undefined;

	if(!spotStorage) {
		return Promise.resolve({
			ok: false,
			reason: 'not-implemented',
			message: queueTranslator.t('storage.electronOnly'),
			status: {
				database: {
					state: 'unavailable'
				}
			}
		});
	}

	return spotStorage.executeTaskCommand(command);
};

// One queue for the whole renderer, so that task writes stay ordered no matter which component made the change
const taskStorageQueue = createStorageQueue<TaskStorageCommand>({
	sendCommand: sendTaskCommandToMainProcess,
	maximumWriteAttempts: STORAGE_CONFIG.maximumWriteAttempts,
	writeRetryDelayMs: STORAGE_CONFIG.writeRetryDelayMs,
	createUnsavedChangesMessage,
	createAbandonedChangeMessage
});

/**
 * Queues a storage command to be written.
 * @param command Storage command to write.
 */
export const sendTaskStorageCommand = (command: TaskStorageCommand): void => {
	taskStorageQueue.sendCommand(command);
};

/**
 * Subscribes to the storage write state.
 * @param subscriber Callback invoked whenever the state changes.
 * @returns The callback that unsubscribes.
 */
export const subscribeToTaskStorageQueue = (subscriber: () => void): () => void => {
	return taskStorageQueue.subscribe(subscriber);
};

/**
 * Returns the latest storage write state.
 * @returns The database status and the message about changes that are not stored.
 */
export const getTaskStorageQueueState = (): TaskStorageQueueState => {
	return taskStorageQueue.getState();
};

/**
 * Writes the queued commands right away instead of waiting out the delay a failed write is retried after.
 * Used when the renderer is asked to save everything under a bounded time, which the retry delay alone could use up.
 */
export const retryTaskStorageQueueNow = (): void => {
	taskStorageQueue.retryNow();
};

/**
 * Waits until every queued command is written.
 * A command that keeps failing keeps the queue busy, so callers that cannot wait forever must bound the wait themselves.
 * @returns A promise that resolves when nothing is left to write.
 */
export const waitForTaskStorageQueue = (): Promise<void> => {
	return taskStorageQueue.waitForIdle();
};

/**
 * Tells whether every task change has reached storage.
 * Used by callers that must not read the database back while the task state is legitimately still ahead of it.
 * @returns Whether nothing is left to write.
 */
export const isTaskStorageQueueIdle = (): boolean => {
	return taskStorageQueue.isIdle();
};

/**
 * Forgets the warnings about changes that were not stored.
 * Used when tasks are loaded again from the database, because the task state does not hold those changes anymore.
 */
export const clearTaskStorageFailures = (): void => {
	taskStorageQueue.clearFailures();
};

/**
 * Drops every queued command and resets the state.
 * Only meant for tests, because the queue is shared by the whole renderer.
 */
export const resetTaskStorageQueueForTests = (): void => {
	taskStorageQueue.reset();
};
