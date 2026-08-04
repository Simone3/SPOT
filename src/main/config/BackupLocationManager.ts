import path from 'node:path';
import { STORAGE_CONFIG } from 'src/config/AppConfig';
import { createSpotConfigStore, type SpotConfigStore } from 'src/main/config/SpotConfigStore';
import type { SpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { spotLogger } from 'src/main/logging/SpotLogger';
import { ensureBackupDirectory, validateBackupDirectory } from 'src/main/storage/BackupDirectory';
import type { TaskStorage } from 'src/main/storage/TaskStorage';
import type { BackupLocation, SetBackupDirectoryResult } from 'src/types/BackupLocationTypes';

type BackupLocationTaskStorage = Pick<TaskStorage, 'setBackupDirectory'>;

export interface CreateBackupLocationManagerOptions {
	runtimePaths: SpotRuntimePaths;
	taskStorage: BackupLocationTaskStorage;
	runExclusively?: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;
	onBackupDirectoryChanged?: () => void;
	configStore?: SpotConfigStore;
}

export interface BackupLocationManager {
	initialize: () => Promise<BackupLocation>;
	getLocation: () => BackupLocation;
	setBackupDirectory: (directory: string) => Promise<SetBackupDirectoryResult>;
	setDefaultBackupDirectory: () => Promise<SetBackupDirectoryResult>;
}

interface ApplyBackupDirectoryOptions {
	persist: boolean;
}

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	return String(error);
};

// Owns the folder that receives the rotated database backups. Changing it never touches the database itself, which always stays in the local
// database directory, so a folder that turns out to be unusable only costs the backups: SPOT falls back to the default folder and keeps working.
export const createBackupLocationManager = ({
	runtimePaths,
	taskStorage,
	runExclusively = (operation) => {
		return operation();
	},
	onBackupDirectoryChanged,
	configStore = createSpotConfigStore(runtimePaths.configFilePath)
}: CreateBackupLocationManagerOptions): BackupLocationManager => {
	const createLocation = (directory: string, message?: string): BackupLocation => {
		return {
			directory,
			defaultDirectory: runtimePaths.defaultBackupDirectory,
			databaseDirectory: runtimePaths.databaseDirectory,
			databasePath: path.join(runtimePaths.databaseDirectory, STORAGE_CONFIG.databaseFileName),
			isDevelopment: runtimePaths.isDevelopment,
			message
		};
	};

	let location = createLocation(runtimePaths.defaultBackupDirectory);

	const createFailure = (message: string): SetBackupDirectoryResult => {
		return {
			ok: false,
			message,
			location
		};
	};

	// Lets a backup that is already being written to the current folder finish before the next one is sent somewhere else
	const applyBackupDirectory = async(
		directory: string,
		{ persist }: ApplyBackupDirectoryOptions
	): Promise<SetBackupDirectoryResult> => {
		try {
			ensureBackupDirectory(directory);
		}
		catch(error) {
			return createFailure(getErrorMessage(error));
		}

		const validation = validateBackupDirectory(directory);

		if(!validation.ok) {
			return createFailure(validation.message);
		}

		const previousDirectory = location.directory;

		await runExclusively(() => {
			taskStorage.setBackupDirectory(directory);

			return Promise.resolve();
		});

		location = createLocation(directory);

		if(persist) {
			configStore.write({ backupDirectory: directory });
		}

		spotLogger.info('Backup folder selected', {
			type: 'config.backupDirectory',
			previousDirectory,
			directory,
			isDevelopment: runtimePaths.isDevelopment
		});

		// The new folder is empty until something is written to it, so the next backup is made to cover the change itself
		onBackupDirectoryChanged?.();

		return {
			ok: true,
			location
		};
	};

	// Development runs always restart on the development backup folder, ignoring any folder selected during a previous development session
	const initialize = async(): Promise<BackupLocation> => {
		const savedDirectory = runtimePaths.isDevelopment ? undefined : configStore.read().backupDirectory;
		const result = await applyBackupDirectory(savedDirectory || runtimePaths.defaultBackupDirectory, { persist: false });

		if(result.ok || !savedDirectory) {
			return location;
		}

		// The saved folder may be on a drive that is not available right now: backups fall back to the default folder without any user action
		spotLogger.warn('The saved backup folder cannot be used', {
			type: 'config.backupDirectory',
			directory: savedDirectory,
			error: result.message
		});

		const fallbackResult = await applyBackupDirectory(runtimePaths.defaultBackupDirectory, { persist: false });

		location = createLocation(runtimePaths.defaultBackupDirectory, fallbackResult.ok ? result.message : fallbackResult.message);

		return location;
	};

	return {
		initialize,
		getLocation: () => {
			return location;
		},
		setBackupDirectory: (directory: string) => {
			return applyBackupDirectory(directory, { persist: true });
		},
		setDefaultBackupDirectory: () => {
			return applyBackupDirectory(runtimePaths.defaultBackupDirectory, { persist: true });
		}
	};
};
