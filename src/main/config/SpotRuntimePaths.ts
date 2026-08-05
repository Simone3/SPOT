import { APP_CONFIG_FILE, BACKUP_CONFIG, LOGGING_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { resolveRuntimePaths, type RuntimePaths, type RuntimePathsApp } from 'src/framework/main/config/RuntimePaths';

export type SpotRuntimePathsApp = RuntimePathsApp;

export type SpotRuntimePaths = RuntimePaths;

// Names the folders and files SPOT keeps inside the Electron user-data folder, and lets the framework lay them out
export const resolveSpotRuntimePaths = (app: SpotRuntimePathsApp): SpotRuntimePaths => {
	return resolveRuntimePaths(app, {
		developmentDirectoryName: APP_CONFIG_FILE.developmentDirectoryName,
		configFileName: APP_CONFIG_FILE.fileName,
		logDirectoryName: LOGGING_CONFIG.directoryName,
		databaseDirectoryName: STORAGE_CONFIG.directoryName,
		databaseFileName: STORAGE_CONFIG.databaseFileName,
		backupDirectoryName: BACKUP_CONFIG.directoryName
	});
};
