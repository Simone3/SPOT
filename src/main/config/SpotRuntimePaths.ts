import path from 'node:path';
import type { App } from 'electron';
import { APP_CONFIG_FILE, BACKUP_CONFIG, LOGGING_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';

export type SpotRuntimePathsApp = Pick<App, 'getPath' | 'isPackaged'>;

export interface SpotRuntimePaths {
	isDevelopment: boolean;
	configFilePath: string;
	logDirectory: string;
	databaseDirectory: string;
	defaultBackupDirectory: string;
}

// Development runs keep their own root folder inside the user-data folder, so a development session never touches the real configuration, logs, database, or backups
export const resolveSpotRuntimePaths = (app: SpotRuntimePathsApp): SpotRuntimePaths => {
	const isDevelopment = !app.isPackaged;
	const userDataDirectory = app.getPath('userData');
	const rootDirectory = isDevelopment ? path.join(userDataDirectory, APP_CONFIG_FILE.developmentDirectoryName) : userDataDirectory;

	return {
		isDevelopment,
		configFilePath: path.join(rootDirectory, APP_CONFIG_FILE.fileName),
		logDirectory: path.join(rootDirectory, LOGGING_CONFIG.directoryName),
		databaseDirectory: path.join(rootDirectory, STORAGE_CONFIG.directoryName),
		defaultBackupDirectory: path.join(rootDirectory, BACKUP_CONFIG.directoryName)
	};
};
