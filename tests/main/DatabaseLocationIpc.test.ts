import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { IpcMain, IpcMainInvokeEvent, OpenDialogReturnValue } from 'electron';
import { STORAGE_CONFIG } from 'src/config/AppConfig';
import type { DatabaseLocationManager } from 'src/main/config/DatabaseLocationManager';
import { registerDatabaseLocationIpcHandlers, SPOT_DATABASE_LOCATION_IPC_CHANNELS } from 'src/main/ipc/DatabaseLocationIpc';
import type { ChooseDatabaseDirectoryResult, DatabaseLocation, SetDatabaseDirectoryResult } from 'src/types/DatabaseLocationTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'spot-location-ipc-'));
	tempDirectories.push(directory);

	return directory;
};

const createMockIpcMain = (): {
	handlers: Map<string, RegisteredIpcHandler>;
	ipcMain: Pick<IpcMain, 'handle'>;
} => {
	const handlers = new Map<string, RegisteredIpcHandler>();
	const ipcMain = {
		handle: jest.fn((channel: string, handler: RegisteredIpcHandler) => {
			handlers.set(channel, handler);
		})
	};

	return {
		handlers,
		ipcMain
	};
};

const createMockManager = (location: DatabaseLocation): DatabaseLocationManager => {
	const setResult: SetDatabaseDirectoryResult = {
		ok: true,
		location
	};

	return {
		initialize: jest.fn(async() => {
			return location;
		}),
		getLocation: jest.fn(() => {
			return location;
		}),
		setDatabaseDirectory: jest.fn(async() => {
			return setResult;
		}),
		setDefaultDatabaseDirectory: jest.fn(async() => {
			return setResult;
		})
	};
};

const createMockDialog = (dialogResult: OpenDialogReturnValue): { showOpenDialog: jest.Mock } => {
	return {
		showOpenDialog: jest.fn(async() => {
			return dialogResult;
		})
	};
};

describe('DatabaseLocationIpc', () => {
	afterAll(() => {
		tempDirectories.forEach((directory) => {
			rmSync(directory, { recursive: true, force: true });
		});
	});

	test('registers the database location handlers and delegates them to the manager', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const location: DatabaseLocation = {
			state: 'configured',
			directory: '/tmp/spot-tasks',
			defaultDirectory: '/tmp/spot-user-data/storage',
			isDevelopment: false
		};
		const databaseLocationManager = createMockManager(location);
		const event = {} as IpcMainInvokeEvent;

		registerDatabaseLocationIpcHandlers({
			ipcMain,
			dialog: createMockDialog({ canceled: true, filePaths: [] }),
			databaseLocationManager
		});

		expect(Array.from(handlers.keys())).toEqual([
			SPOT_DATABASE_LOCATION_IPC_CHANNELS.getDatabaseLocation,
			SPOT_DATABASE_LOCATION_IPC_CHANNELS.chooseDatabaseDirectory,
			SPOT_DATABASE_LOCATION_IPC_CHANNELS.setDatabaseDirectory,
			SPOT_DATABASE_LOCATION_IPC_CHANNELS.setDefaultDatabaseDirectory
		]);
		expect(handlers.get(SPOT_DATABASE_LOCATION_IPC_CHANNELS.getDatabaseLocation)!(event)).toBe(location);
		await handlers.get(SPOT_DATABASE_LOCATION_IPC_CHANNELS.setDatabaseDirectory)!(event, '/tmp/other-folder');
		await handlers.get(SPOT_DATABASE_LOCATION_IPC_CHANNELS.setDefaultDatabaseDirectory)!(event);
		expect(databaseLocationManager.setDatabaseDirectory).toHaveBeenCalledWith('/tmp/other-folder');
		expect(databaseLocationManager.setDefaultDatabaseDirectory).toHaveBeenCalledTimes(1);
	});

	test('reports a cancelled folder dialog without changing anything', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const databaseLocationManager = createMockManager({
			state: 'unconfigured',
			defaultDirectory: '/tmp/spot-user-data/storage',
			isDevelopment: false
		});

		registerDatabaseLocationIpcHandlers({
			ipcMain,
			dialog: createMockDialog({ canceled: true, filePaths: [] }),
			databaseLocationManager
		});

		const result = await handlers.get(SPOT_DATABASE_LOCATION_IPC_CHANNELS.chooseDatabaseDirectory)!({} as IpcMainInvokeEvent) as ChooseDatabaseDirectoryResult;

		expect(result).toEqual({
			ok: false,
			reason: 'cancelled'
		});
		expect(databaseLocationManager.setDatabaseDirectory).not.toHaveBeenCalled();
	});

	test('reports whether the chosen folder already contains a task database', async() => {
		const emptyDirectory = makeTempDirectory();
		const usedDirectory = makeTempDirectory();
		writeFileSync(path.join(usedDirectory, STORAGE_CONFIG.databaseFileName), '', 'utf8');
		const databaseLocationManager = createMockManager({
			state: 'unconfigured',
			defaultDirectory: '/tmp/spot-user-data/storage',
			isDevelopment: false
		});

		const chooseDirectory = async(directory: string): Promise<ChooseDatabaseDirectoryResult> => {
			const { handlers, ipcMain } = createMockIpcMain();

			registerDatabaseLocationIpcHandlers({
				ipcMain,
				dialog: createMockDialog({ canceled: false, filePaths: [ directory ] }),
				databaseLocationManager
			});

			return await handlers.get(SPOT_DATABASE_LOCATION_IPC_CHANNELS.chooseDatabaseDirectory)!({} as IpcMainInvokeEvent) as ChooseDatabaseDirectoryResult;
		};

		await expect(chooseDirectory(emptyDirectory)).resolves.toEqual({
			ok: true,
			directory: emptyDirectory,
			hasExistingDatabase: false
		});
		await expect(chooseDirectory(usedDirectory)).resolves.toEqual({
			ok: true,
			directory: usedDirectory,
			hasExistingDatabase: true
		});
	});
});
