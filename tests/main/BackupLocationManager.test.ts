import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { APP_CONFIG_FILE, BACKUP_CONFIG, LOGGING_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { createBackupLocationManager } from 'src/main/config/BackupLocationManager';
import type { SpotConfig, SpotConfigStore } from 'src/main/config/SpotConfigStore';
import type { SpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { resetSpotLoggerForTests } from 'src/main/logging/SpotLogger';
import type { TaskStorage } from 'src/main/storage/TaskStorage';

interface FakeTaskStorage {
	selectedDirectories: string[];
	taskStorage: Pick<TaskStorage, 'setBackupDirectory'>;
}

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'spot-backup-location-'));
	tempDirectories.push(directory);

	return directory;
};

const createRuntimePaths = (rootDirectory: string, isDevelopment = false): SpotRuntimePaths => {
	return {
		isDevelopment,
		configFilePath: path.join(rootDirectory, APP_CONFIG_FILE.fileName),
		logDirectory: path.join(rootDirectory, LOGGING_CONFIG.directoryName),
		databaseDirectory: path.join(rootDirectory, STORAGE_CONFIG.directoryName),
		defaultBackupDirectory: path.join(rootDirectory, BACKUP_CONFIG.directoryName)
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

const createFakeTaskStorage = (): FakeTaskStorage => {
	const selectedDirectories: string[] = [];

	return {
		selectedDirectories,
		taskStorage: {
			setBackupDirectory: jest.fn((directory: string) => {
				selectedDirectories.push(directory);
			})
		}
	};
};

describe('BackupLocationManager', () => {
	afterEach(() => {
		resetSpotLoggerForTests();

		while(tempDirectories.length > 0) {
			rmSync(tempDirectories.pop()!, { recursive: true, force: true });
		}
	});

	test('starts on the default backup folder and creates it', async() => {
		const rootDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { configStore } = createFakeConfigStore();
		const { selectedDirectories, taskStorage } = createFakeTaskStorage();
		const manager = createBackupLocationManager({ runtimePaths, taskStorage, configStore });

		const location = await manager.initialize();

		expect(location).toMatchObject({
			directory: runtimePaths.defaultBackupDirectory,
			defaultDirectory: runtimePaths.defaultBackupDirectory,
			databaseDirectory: runtimePaths.databaseDirectory,
			databasePath: path.join(runtimePaths.databaseDirectory, STORAGE_CONFIG.databaseFileName)
		});
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory ]);
		expect(existsSync(runtimePaths.defaultBackupDirectory)).toBe(true);
	});

	test('reuses the saved backup folder without persisting it again', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { configStore } = createFakeConfigStore({ backupDirectory: savedDirectory });
		const { selectedDirectories, taskStorage } = createFakeTaskStorage();
		const manager = createBackupLocationManager({ runtimePaths, taskStorage, configStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(savedDirectory);
		expect(selectedDirectories).toEqual([ savedDirectory ]);
		expect(configStore.write).not.toHaveBeenCalled();
	});

	// The tasks live in the local database, so an unreachable backup folder only costs the copies
	test('falls back to the default folder when the saved one cannot be used', async() => {
		const rootDirectory = makeTempDirectory();
		const blockedDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(blockedDirectory, 'not a folder', 'utf8');
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { configStore } = createFakeConfigStore({ backupDirectory: blockedDirectory });
		const { taskStorage } = createFakeTaskStorage();
		const manager = createBackupLocationManager({ runtimePaths, taskStorage, configStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.message).toBeTruthy();
	});

	test('ignores the saved folder on a development run', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory, true);
		const { configStore } = createFakeConfigStore({ backupDirectory: savedDirectory });
		const { selectedDirectories, taskStorage } = createFakeTaskStorage();
		const manager = createBackupLocationManager({ runtimePaths, taskStorage, configStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.isDevelopment).toBe(true);
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory ]);
	});

	test('persists a backup folder chosen by the user and asks for a backup covering the change', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { configStore, getConfig } = createFakeConfigStore();
		const { selectedDirectories, taskStorage } = createFakeTaskStorage();
		const onBackupDirectoryChanged = jest.fn();
		const manager = createBackupLocationManager({ runtimePaths, taskStorage, configStore, onBackupDirectoryChanged });

		await manager.initialize();
		const result = await manager.setBackupDirectory(chosenDirectory);

		expect(result).toMatchObject({
			ok: true,
			location: {
				directory: chosenDirectory
			}
		});
		expect(getConfig()).toEqual({ backupDirectory: chosenDirectory });
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory, chosenDirectory ]);
		expect(onBackupDirectoryChanged).toHaveBeenCalledTimes(2);
	});

	test('keeps the current folder when the chosen one cannot be used', async() => {
		const rootDirectory = makeTempDirectory();
		const blockedDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(blockedDirectory, 'not a folder', 'utf8');
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { configStore, getConfig } = createFakeConfigStore();
		const { taskStorage } = createFakeTaskStorage();
		const manager = createBackupLocationManager({ runtimePaths, taskStorage, configStore });

		await manager.initialize();
		const result = await manager.setBackupDirectory(blockedDirectory);

		expect(result.ok).toBe(false);
		expect(manager.getLocation().directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(getConfig()).toEqual({});
	});

	test('runs the folder change on the storage chain', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { configStore } = createFakeConfigStore();
		const { taskStorage } = createFakeTaskStorage();
		const trackExclusiveRun = jest.fn();
		const runExclusively = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
			trackExclusiveRun();

			return operation();
		};
		const manager = createBackupLocationManager({ runtimePaths, taskStorage, configStore, runExclusively });

		await manager.initialize();
		await manager.setBackupDirectory(chosenDirectory);

		expect(trackExclusiveRun).toHaveBeenCalledTimes(2);
	});
});
