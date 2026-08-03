import { flushPendingTaskChanges, installPendingTaskChangesFlushHandler, registerPendingTaskChangesFlushListener, trackPendingTaskCommand } from 'src/logic/PendingTaskChanges';
import type { SpotStorageApi } from 'src/types/TaskStorageTypes';

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

const createMockSpotStorage = (): {
	spotStorage: SpotStorageApi;
	requestFlush: () => void;
} => {
	const flushListeners = new Set<() => void>();
	const spotStorage = {
		loadTasks: jest.fn(),
		executeTaskCommand: jest.fn(),
		getStorageStatus: jest.fn(),
		onFlushPendingTaskChanges: jest.fn((listener: () => void) => {
			flushListeners.add(listener);

			return () => {
				flushListeners.delete(listener);
			};
		}),
		notifyPendingTaskChangesFlushed: jest.fn(async() => {
			return undefined;
		})
	} as unknown as SpotStorageApi;

	return {
		spotStorage,
		requestFlush: () => {
			flushListeners.forEach((listener) => {
				listener();
			});
		}
	};
};

describe('PendingTaskChanges', () => {
	test('flushes buffered changes and waits for the storage commands they dispatch', async() => {
		const commandDeferred = createDeferred<void>();
		const completionOrder: string[] = [];
		const unregister = registerPendingTaskChangesFlushListener(() => {
			completionOrder.push('flush-listener');
			trackPendingTaskCommand(commandDeferred.promise.then(() => {
				completionOrder.push('command');
			}));
		});

		let didFlushSettle = false;
		const flushPromise = flushPendingTaskChanges().then(() => {
			didFlushSettle = true;
		});

		await Promise.resolve();
		expect(completionOrder).toEqual([ 'flush-listener' ]);
		expect(didFlushSettle).toBe(false);

		commandDeferred.resolve();
		await flushPromise;

		expect(completionOrder).toEqual([ 'flush-listener', 'command' ]);
		expect(didFlushSettle).toBe(true);

		unregister();
	});

	test('stops flushing unregistered listeners', async() => {
		const listener = jest.fn();
		const unregister = registerPendingTaskChangesFlushListener(listener);

		unregister();
		await flushPendingTaskChanges();

		expect(listener).not.toHaveBeenCalled();
	});

	test('still resolves when a tracked storage command fails', async() => {
		const unregister = registerPendingTaskChangesFlushListener(() => {
			trackPendingTaskCommand(Promise.reject(new Error('Storage is unavailable.')));
		});

		await expect(flushPendingTaskChanges()).resolves.toBeUndefined();

		unregister();
	});

	test('reports to the main process only after the buffered changes reached storage', async() => {
		const { spotStorage, requestFlush } = createMockSpotStorage();
		const commandDeferred = createDeferred<void>();
		const unregister = registerPendingTaskChangesFlushListener(() => {
			trackPendingTaskCommand(commandDeferred.promise);
		});
		const uninstall = installPendingTaskChangesFlushHandler(spotStorage);

		requestFlush();
		await waitForQueuedWork();

		expect(spotStorage.notifyPendingTaskChangesFlushed).not.toHaveBeenCalled();

		commandDeferred.resolve();
		await waitForQueuedWork();

		expect(spotStorage.notifyPendingTaskChangesFlushed).toHaveBeenCalledTimes(1);

		unregister();
		uninstall?.();
	});

	test('does nothing without the Electron storage API', () => {
		expect(installPendingTaskChangesFlushHandler(undefined)).toBeUndefined();
	});
});
