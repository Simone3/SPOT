import type { SpotStorageApi } from 'src/types/TaskStorageTypes';

type PendingTaskChangesFlushListener = () => void;

const flushListeners = new Set<PendingTaskChangesFlushListener>();

const pendingTaskCommands = new Set<Promise<unknown>>();

/**
 * Registers a callback that pushes the task changes buffered by a task component into the task state.
 * Listeners must dispatch their storage commands synchronously, so that a flush can wait for all of them.
 * @param listener Callback that flushes buffered task changes.
 * @returns The callback that unregisters the listener.
 */
export const registerPendingTaskChangesFlushListener = (listener: PendingTaskChangesFlushListener): () => void => {
	flushListeners.add(listener);

	return () => {
		flushListeners.delete(listener);
	};
};

/**
 * Tracks a storage command until it settles, so that a flush can wait for it.
 * @param commandPromise Storage command to track.
 */
export const trackPendingTaskCommand = (commandPromise: Promise<unknown>): void => {
	pendingTaskCommands.add(commandPromise);

	void commandPromise.then(() => {
		pendingTaskCommands.delete(commandPromise);
	}, () => {
		pendingTaskCommands.delete(commandPromise);
	});
};

/**
 * Flushes every buffered task change and waits for the storage commands they produce, plus the ones already in flight.
 * @returns A promise that resolves when nothing is left to save.
 */
export const flushPendingTaskChanges = async(): Promise<void> => {
	Array.from(flushListeners).forEach((listener) => {
		listener();
	});

	await Promise.allSettled(Array.from(pendingTaskCommands));
};

/**
 * Answers the main-process request to save the task changes still buffered in the renderer before the application quits.
 * Without the Electron storage API there is nothing to answer to, and buffered changes are handled by the component unmount and page hide flushes only.
 * @param spotStorage Storage API to subscribe to.
 * @returns The callback that unregisters the handler, or undefined when the storage API is unavailable.
 */
export const installPendingTaskChangesFlushHandler = (spotStorage: SpotStorageApi | undefined = window.spotStorage): (() => void) | undefined => {
	if(!spotStorage?.onFlushPendingTaskChanges) {
		return undefined;
	}

	return spotStorage.onFlushPendingTaskChanges(() => {
		void flushPendingTaskChanges().then(() => {
			return spotStorage.notifyPendingTaskChangesFlushed();
		}, () => {
			return spotStorage.notifyPendingTaskChangesFlushed();
		});
	});
};
