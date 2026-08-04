import path from 'node:path';
import type { App } from 'electron';
import { APP_CONFIG_FILE, BACKUP_CONFIG, LOGGING_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { resolveSpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';

const userDataPath = path.join('/tmp', 'spot-user-data');

const createMockApp = (isPackaged: boolean): Pick<App, 'getPath' | 'isPackaged'> => {
	return {
		getPath: jest.fn(() => {
			return userDataPath;
		}),
		isPackaged
	} as unknown as Pick<App, 'getPath' | 'isPackaged'>;
};

describe('SpotRuntimePaths', () => {
	test('resolves packaged paths inside the Electron user-data folder', () => {
		const app = createMockApp(true);

		expect(resolveSpotRuntimePaths(app)).toEqual({
			isDevelopment: false,
			configFilePath: path.join(userDataPath, APP_CONFIG_FILE.fileName),
			logDirectory: path.join(userDataPath, LOGGING_CONFIG.directoryName),
			databaseDirectory: path.join(userDataPath, STORAGE_CONFIG.directoryName),
			defaultBackupDirectory: path.join(userDataPath, BACKUP_CONFIG.directoryName)
		});
		expect(app.getPath).toHaveBeenCalledWith('userData');
	});

	test('keeps development paths in a separate development folder', () => {
		const developmentPath = path.join(userDataPath, APP_CONFIG_FILE.developmentDirectoryName);

		expect(resolveSpotRuntimePaths(createMockApp(false))).toEqual({
			isDevelopment: true,
			configFilePath: path.join(developmentPath, APP_CONFIG_FILE.fileName),
			logDirectory: path.join(developmentPath, LOGGING_CONFIG.directoryName),
			databaseDirectory: path.join(developmentPath, STORAGE_CONFIG.directoryName),
			defaultBackupDirectory: path.join(developmentPath, BACKUP_CONFIG.directoryName)
		});
	});
});
