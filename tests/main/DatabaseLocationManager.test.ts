import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { APP_CONFIG_FILE, LOGGING_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { createDatabaseLocationManager } from 'src/main/config/DatabaseLocationManager';
import type { SpotConfig, SpotConfigStore } from 'src/main/config/SpotConfigStore';
import type { SpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { resetSpotLoggerForTests } from 'src/main/logging/SpotLogger';
import type { TaskStorage } from 'src/main/storage/TaskStorage';
import type { StorageStatus } from 'src/types/TaskStorageTypes';

interface FakeTaskStorage {
	openedDirectories: string[];
	taskStorage: Pick<TaskStorage, 'openStorageDirectory'>;
}

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'spot-location-'));
	tempDirectories.push(directory);

	return directory;
};

const createRuntimePaths = (rootDirectory: string, isDevelopment = false): SpotRuntimePaths => {
	return {
		isDevelopment,
		configFilePath: path.join(rootDirectory, APP_CONFIG_FILE.fileName),
		logDirectory: path.join(rootDirectory, LOGGING_CONFIG.directoryName),
		defaultDatabaseDirectory: path.join(rootDirectory, STORAGE_CONFIG.directoryName)
	};
};

const createFakeConfigStore = (config: SpotConfig = {}): {
	configStore: SpotConfigStore;
	getConfig: () => SpotConfig;
} => {
	let currentConfig = config;

	return {
		configStore: {
			read: () => {
				return currentConfig;
			},
			write: jest.fn((nextConfig: SpotConfig) => {
				currentConfig = nextConfig;
			})
		},
		getConfig: () => {
			return currentConfig;
		}
	};
};

const createFakeTaskStorage = (unavailableDirectories: string[] = []): FakeTaskStorage => {
	const openedDirectories: string[] = [];

	return {
		openedDirectories,
		taskStorage: {
			openStorageDirectory: jest.fn((directory: string): Promise<StorageStatus> => {
				openedDirectories.push(directory);

				if(unavailableDirectories.includes(directory)) {
					return Promise.resolve({
						database: {
							state: 'unavailable',
							message: 'The database file is corrupted.'
						},
						storageDirectory: directory
					});
				}

				return Promise.resolve({
					database: {
						state: 'healthy'
					},
					storageDirectory: directory
				});
			})
		}
	};
};

describe('DatabaseLocationManager', () => {
	afterEach(() => {
		resetSpotLoggerForTests();
		jest.restoreAllMocks();
	});

	afterAll(() => {
		tempDirectories.forEach((directory) => {
			rmSync(directory, { recursive: true, force: true });
		});
	});

	test('asks for a folder on the first startup', async() => {
		const { configStore } = createFakeConfigStore();
		const { taskStorage, openedDirectories } = createFakeTaskStorage();
		const manager = createDatabaseLocationManager({
			runtimePaths: createRuntimePaths(makeTempDirectory()),
			taskStorage,
			configStore
		});

		const location = await manager.initialize();

		expect(location.state).toBe('unconfigured');
		expect(location.message).toBeUndefined();
		expect(openedDirectories).toEqual([]);
	});

	test('reuses the saved folder on later startups without saving it again', async() => {
		const databaseDirectory = makeTempDirectory();
		const { configStore, getConfig } = createFakeConfigStore({ databaseDirectory });
		const { taskStorage, openedDirectories } = createFakeTaskStorage();
		const manager = createDatabaseLocationManager({
			runtimePaths: createRuntimePaths(makeTempDirectory()),
			taskStorage,
			configStore
		});

		const location = await manager.initialize();

		expect(location.state).toBe('configured');
		expect(location.directory).toBe(databaseDirectory);
		expect(openedDirectories).toEqual([ databaseDirectory ]);
		expect(configStore.write).not.toHaveBeenCalled();
		expect(getConfig().databaseDirectory).toBe(databaseDirectory);
	});

	test('asks for a folder again when the saved one is not available', async() => {
		const databaseDirectory = path.join(makeTempDirectory(), 'deleted-folder');
		const { configStore } = createFakeConfigStore({ databaseDirectory });
		const { taskStorage, openedDirectories } = createFakeTaskStorage();
		const manager = createDatabaseLocationManager({
			runtimePaths: createRuntimePaths(makeTempDirectory()),
			taskStorage,
			configStore
		});

		const location = await manager.initialize();

		expect(location.state).toBe('unconfigured');
		expect(location.message).toContain(databaseDirectory);
		expect(openedDirectories).toEqual([]);
	});

	test('always restarts development runs on the development folder', async() => {
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(makeTempDirectory(), true);
		const { configStore } = createFakeConfigStore({ databaseDirectory: savedDirectory });
		const { taskStorage, openedDirectories } = createFakeTaskStorage();
		const manager = createDatabaseLocationManager({
			runtimePaths,
			taskStorage,
			configStore
		});

		const location = await manager.initialize();

		expect(location.state).toBe('configured');
		expect(location.directory).toBe(runtimePaths.defaultDatabaseDirectory);
		expect(location.isDevelopment).toBe(true);
		expect(openedDirectories).toEqual([ runtimePaths.defaultDatabaseDirectory ]);
		expect(existsSync(runtimePaths.defaultDatabaseDirectory)).toBe(true);
	});

	test('saves the chosen folder after finalizing the work pending on the previous one', async() => {
		const firstDirectory = makeTempDirectory();
		const secondDirectory = makeTempDirectory();
		const { configStore, getConfig } = createFakeConfigStore({ databaseDirectory: firstDirectory });
		const { taskStorage, openedDirectories } = createFakeTaskStorage();
		const runExclusivelyCalls: string[] = [];
		const manager = createDatabaseLocationManager({
			runtimePaths: createRuntimePaths(makeTempDirectory()),
			taskStorage,
			configStore,
			runExclusively: async(operation) => {
				runExclusivelyCalls.push('drain');

				return operation();
			}
		});

		await manager.initialize();
		const result = await manager.setDatabaseDirectory(secondDirectory);

		expect(result.ok).toBe(true);
		expect(manager.getLocation().directory).toBe(secondDirectory);
		expect(openedDirectories).toEqual([ firstDirectory, secondDirectory ]);
		expect(runExclusivelyCalls).toEqual([ 'drain', 'drain' ]);
		expect(getConfig().databaseDirectory).toBe(secondDirectory);
	});

	test('keeps the previous folder when the new one cannot be opened', async() => {
		const firstDirectory = makeTempDirectory();
		const brokenDirectory = makeTempDirectory();
		const { configStore, getConfig } = createFakeConfigStore({ databaseDirectory: firstDirectory });
		const { taskStorage, openedDirectories } = createFakeTaskStorage([ brokenDirectory ]);
		const manager = createDatabaseLocationManager({
			runtimePaths: createRuntimePaths(makeTempDirectory()),
			taskStorage,
			configStore
		});

		await manager.initialize();
		const result = await manager.setDatabaseDirectory(brokenDirectory);

		expect(result.ok).toBe(false);
		expect(result.ok ? undefined : result.message).toBe('The database file is corrupted.');
		expect(manager.getLocation().directory).toBe(firstDirectory);
		expect(openedDirectories).toEqual([ firstDirectory, brokenDirectory, firstDirectory ]);
		expect(getConfig().databaseDirectory).toBe(firstDirectory);
	});

	test('creates the default folder when the user picks it', async() => {
		const runtimePaths = createRuntimePaths(makeTempDirectory());
		const { configStore, getConfig } = createFakeConfigStore();
		const { taskStorage } = createFakeTaskStorage();
		const manager = createDatabaseLocationManager({
			runtimePaths,
			taskStorage,
			configStore
		});

		await manager.initialize();
		const result = await manager.setDefaultDatabaseDirectory();

		expect(result.ok).toBe(true);
		expect(existsSync(runtimePaths.defaultDatabaseDirectory)).toBe(true);
		expect(manager.getLocation().directory).toBe(runtimePaths.defaultDatabaseDirectory);
		expect(getConfig().databaseDirectory).toBe(runtimePaths.defaultDatabaseDirectory);
	});
});
