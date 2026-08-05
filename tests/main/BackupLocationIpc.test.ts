import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { IpcMain, IpcMainInvokeEvent, OpenDialogReturnValue } from 'electron';
import type { BackupLocationManager } from 'src/framework/main/config/BackupLocationManager';
import { registerBackupLocationIpcHandlers, SPOT_BACKUP_LOCATION_IPC_CHANNELS } from 'src/main/ipc/BackupLocationIpc';
import type { BackupLocation, ChooseBackupDirectoryResult, SetBackupDirectoryResult } from 'src/types/BackupLocationTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const tempDirectories: string[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'spot-backup-ipc-'));
	tempDirectories.push(directory);

	return directory;
};

const createLocation = (directory: string): BackupLocation => {
	return {
		directory,
		defaultDirectory: '/tmp/spot-user-data/backups',
		databaseDirectory: '/tmp/spot-user-data/storage',
		databasePath: '/tmp/spot-user-data/storage/spot.sqlite',
		isDevelopment: false
	};
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

const createMockManager = (location: BackupLocation): BackupLocationManager => {
	const setResult: SetBackupDirectoryResult = {
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
		setBackupDirectory: jest.fn(async() => {
			return setResult;
		}),
		setDefaultBackupDirectory: jest.fn(async() => {
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

describe('BackupLocationIpc', () => {
	afterAll(() => {
		tempDirectories.forEach((directory) => {
			rmSync(directory, { recursive: true, force: true });
		});
	});

	test('registers the backup location handlers and delegates them to the manager', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const location = createLocation('/tmp/spot-backups');
		const backupLocationManager = createMockManager(location);
		const event = {} as IpcMainInvokeEvent;

		registerBackupLocationIpcHandlers({
			ipcMain,
			dialog: createMockDialog({ canceled: true, filePaths: [] }),
			backupLocationManager
		});

		expect(Array.from(handlers.keys())).toEqual([
			SPOT_BACKUP_LOCATION_IPC_CHANNELS.getBackupLocation,
			SPOT_BACKUP_LOCATION_IPC_CHANNELS.chooseBackupDirectory,
			SPOT_BACKUP_LOCATION_IPC_CHANNELS.setBackupDirectory,
			SPOT_BACKUP_LOCATION_IPC_CHANNELS.setDefaultBackupDirectory
		]);
		expect(handlers.get(SPOT_BACKUP_LOCATION_IPC_CHANNELS.getBackupLocation)!(event)).toBe(location);
		await handlers.get(SPOT_BACKUP_LOCATION_IPC_CHANNELS.setBackupDirectory)!(event, '/tmp/other-folder');
		await handlers.get(SPOT_BACKUP_LOCATION_IPC_CHANNELS.setDefaultBackupDirectory)!(event);
		expect(backupLocationManager.setBackupDirectory).toHaveBeenCalledWith('/tmp/other-folder');
		expect(backupLocationManager.setDefaultBackupDirectory).toHaveBeenCalledTimes(1);
	});

	test('reports a cancelled folder dialog without changing anything', async() => {
		const { handlers, ipcMain } = createMockIpcMain();
		const backupLocationManager = createMockManager(createLocation('/tmp/spot-backups'));

		registerBackupLocationIpcHandlers({
			ipcMain,
			dialog: createMockDialog({ canceled: true, filePaths: [] }),
			backupLocationManager
		});

		const result = await handlers.get(SPOT_BACKUP_LOCATION_IPC_CHANNELS.chooseBackupDirectory)!({} as IpcMainInvokeEvent) as ChooseBackupDirectoryResult;

		expect(result).toEqual({
			ok: false,
			reason: 'cancelled'
		});
		expect(backupLocationManager.setBackupDirectory).not.toHaveBeenCalled();
	});

	test('rejects a chosen path that is not a usable folder', async() => {
		const usableDirectory = makeTempDirectory();
		const filePath = path.join(makeTempDirectory(), 'not-a-folder');
		writeFileSync(filePath, '', 'utf8');
		const backupLocationManager = createMockManager(createLocation(usableDirectory));

		const chooseDirectory = async(directory: string): Promise<ChooseBackupDirectoryResult> => {
			const { handlers, ipcMain } = createMockIpcMain();

			registerBackupLocationIpcHandlers({
				ipcMain,
				dialog: createMockDialog({ canceled: false, filePaths: [ directory ] }),
				backupLocationManager
			});

			return await handlers.get(SPOT_BACKUP_LOCATION_IPC_CHANNELS.chooseBackupDirectory)!({} as IpcMainInvokeEvent) as ChooseBackupDirectoryResult;
		};

		await expect(chooseDirectory(usableDirectory)).resolves.toEqual({
			ok: true,
			directory: usableDirectory
		});
		await expect(chooseDirectory(filePath)).resolves.toMatchObject({
			ok: false,
			reason: 'invalid-directory'
		});
	});
});
