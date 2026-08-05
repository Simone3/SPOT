import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBackupLocationManager, type BackupDirectoryStore } from 'src/framework/main/config/BackupLocationManager';
import type { RuntimePaths } from 'src/framework/main/config/RuntimePaths';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';

const DATABASE_FILE_NAME = 'app.sqlite';

interface FakeStorage {
	selectedDirectories: string[];
	storage: {
		setBackupDirectory: (directory: string) => void;
	};
}

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'backup-location-'));
	tempDirectories.push(directory);

	return directory;
};

const createRuntimePaths = (rootDirectory: string, isDevelopment = false): RuntimePaths => {
	const databaseDirectory = path.join(rootDirectory, 'storage');

	return {
		isDevelopment,
		rootDirectory,
		configFilePath: path.join(rootDirectory, 'app-config.json'),
		logDirectory: path.join(rootDirectory, 'logs'),
		databaseDirectory,
		databasePath: path.join(databaseDirectory, DATABASE_FILE_NAME),
		defaultBackupDirectory: path.join(rootDirectory, 'backups')
	};
};

const createFakeDirectoryStore = (savedDirectory?: string): {
	directoryStore: BackupDirectoryStore;
	getSavedDirectory: () => string | undefined;
} => {
	let currentDirectory = savedDirectory;

	return {
		directoryStore: {
			read: () => {
				return currentDirectory;
			},
			write: jest.fn((directory: string) => {
				currentDirectory = directory;
			})
		},
		getSavedDirectory: () => {
			return currentDirectory;
		}
	};
};

const createFakeStorage = (): FakeStorage => {
	const selectedDirectories: string[] = [];

	return {
		selectedDirectories,
		storage: {
			setBackupDirectory: jest.fn((directory: string) => {
				selectedDirectories.push(directory);
			})
		}
	};
};

describe('BackupLocationManager', () => {
	afterEach(() => {
		resetAppLoggerForTests();

		while(tempDirectories.length > 0) {
			rmSync(tempDirectories.pop()!, { recursive: true, force: true });
		}
	});

	test('starts on the default backup folder and creates it', async() => {
		const rootDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore();
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore });

		const location = await manager.initialize();

		expect(location).toMatchObject({
			directory: runtimePaths.defaultBackupDirectory,
			defaultDirectory: runtimePaths.defaultBackupDirectory,
			databaseDirectory: runtimePaths.databaseDirectory,
			databasePath: runtimePaths.databasePath
		});
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory ]);
		expect(existsSync(runtimePaths.defaultBackupDirectory)).toBe(true);
	});

	test('reuses the saved backup folder without persisting it again', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore(savedDirectory);
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(savedDirectory);
		expect(selectedDirectories).toEqual([ savedDirectory ]);
		expect(directoryStore.write).not.toHaveBeenCalled();
	});

	// The records live in the local database, so an unreachable backup folder only costs the copies
	test('falls back to the default folder when the saved one cannot be used', async() => {
		const rootDirectory = makeTempDirectory();
		const blockedDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(blockedDirectory, 'not a folder', 'utf8');
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore(blockedDirectory);
		const { storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.message).toBeTruthy();
	});

	test('ignores the saved folder on a development run', async() => {
		const rootDirectory = makeTempDirectory();
		const savedDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory, true);
		const { directoryStore } = createFakeDirectoryStore(savedDirectory);
		const { selectedDirectories, storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore });

		const location = await manager.initialize();

		expect(location.directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(location.isDevelopment).toBe(true);
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory ]);
	});

	test('persists a backup folder chosen by the user and asks for a backup covering the change', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore, getSavedDirectory } = createFakeDirectoryStore();
		const { selectedDirectories, storage } = createFakeStorage();
		const onBackupDirectoryChanged = jest.fn();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, onBackupDirectoryChanged });

		await manager.initialize();
		const result = await manager.setBackupDirectory(chosenDirectory);

		expect(result).toMatchObject({
			ok: true,
			location: {
				directory: chosenDirectory
			}
		});
		expect(getSavedDirectory()).toBe(chosenDirectory);
		expect(selectedDirectories).toEqual([ runtimePaths.defaultBackupDirectory, chosenDirectory ]);
		expect(onBackupDirectoryChanged).toHaveBeenCalledTimes(2);
	});

	test('keeps the current folder when the chosen one cannot be used', async() => {
		const rootDirectory = makeTempDirectory();
		const blockedDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(blockedDirectory, 'not a folder', 'utf8');
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore, getSavedDirectory } = createFakeDirectoryStore();
		const { storage } = createFakeStorage();
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore });

		await manager.initialize();
		const result = await manager.setBackupDirectory(blockedDirectory);

		expect(result.ok).toBe(false);
		expect(manager.getLocation().directory).toBe(runtimePaths.defaultBackupDirectory);
		expect(getSavedDirectory()).toBeUndefined();
	});

	test('runs the folder change on the storage chain', async() => {
		const rootDirectory = makeTempDirectory();
		const chosenDirectory = makeTempDirectory();
		const runtimePaths = createRuntimePaths(rootDirectory);
		const { directoryStore } = createFakeDirectoryStore();
		const { storage } = createFakeStorage();
		const trackExclusiveRun = jest.fn();
		const runExclusively = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
			trackExclusiveRun();

			return operation();
		};
		const manager = createBackupLocationManager({ runtimePaths, storage, directoryStore, runExclusively });

		await manager.initialize();
		await manager.setBackupDirectory(chosenDirectory);

		expect(trackExclusiveRun).toHaveBeenCalledTimes(2);
	});
});
