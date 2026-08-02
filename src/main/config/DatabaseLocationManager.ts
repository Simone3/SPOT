import { createSpotConfigStore, type SpotConfigStore } from 'src/main/config/SpotConfigStore';
import type { SpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { spotLogger } from 'src/main/logging/SpotLogger';
import { ensureDatabaseDirectory, validateDatabaseDirectory } from 'src/main/storage/DatabaseDirectory';
import type { TaskStorage } from 'src/main/storage/TaskStorage';
import type { DatabaseLocation, SetDatabaseDirectoryResult } from 'src/types/DatabaseLocationTypes';

export const DATABASE_DIRECTORY_UNAVAILABLE_MESSAGE = 'The task database could not be opened in the selected folder.';

type DatabaseLocationTaskStorage = Pick<TaskStorage, 'openStorageDirectory'>;

export interface CreateDatabaseLocationManagerOptions {
	runtimePaths: SpotRuntimePaths;
	taskStorage: DatabaseLocationTaskStorage;
	runExclusively?: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;
	configStore?: SpotConfigStore;
}

export interface DatabaseLocationManager {
	initialize: () => Promise<DatabaseLocation>;
	getLocation: () => DatabaseLocation;
	setDatabaseDirectory: (directory: string) => Promise<SetDatabaseDirectoryResult>;
	setDefaultDatabaseDirectory: () => Promise<SetDatabaseDirectoryResult>;
}

interface ApplyDatabaseDirectoryOptions {
	persist: boolean;
}

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	return String(error);
};

export const createDatabaseLocationManager = ({
	runtimePaths,
	taskStorage,
	runExclusively = (operation) => {
		return operation();
	},
	configStore = createSpotConfigStore(runtimePaths.configFilePath)
}: CreateDatabaseLocationManagerOptions): DatabaseLocationManager => {
	let location: DatabaseLocation = {
		state: 'unconfigured',
		defaultDirectory: runtimePaths.defaultDatabaseDirectory,
		isDevelopment: runtimePaths.isDevelopment
	};

	const createUnconfiguredLocation = (message?: string): DatabaseLocation => {
		return {
			state: 'unconfigured',
			defaultDirectory: runtimePaths.defaultDatabaseDirectory,
			isDevelopment: runtimePaths.isDevelopment,
			message
		};
	};

	const createConfiguredLocation = (directory: string): DatabaseLocation => {
		return {
			state: 'configured',
			directory,
			defaultDirectory: runtimePaths.defaultDatabaseDirectory,
			isDevelopment: runtimePaths.isDevelopment
		};
	};

	const createFailure = (message: string): SetDatabaseDirectoryResult => {
		return {
			ok: false,
			message,
			location
		};
	};

	const restorePreviousDirectory = async(previousDirectory: string | undefined): Promise<void> => {
		if(!previousDirectory) {
			return;
		}

		try {
			await taskStorage.openStorageDirectory(previousDirectory);
		}
		catch(error) {
			spotLogger.error('Could not reopen the previous task database folder', {
				type: 'config.databaseDirectory',
				directory: previousDirectory,
				error: getErrorMessage(error)
			});
		}
	};

	// Finalizes the commands still running on the current database before opening the new one, and falls back to the previous folder when the new one cannot be opened
	const applyDatabaseDirectory = async(
		directory: string,
		{ persist }: ApplyDatabaseDirectoryOptions
	): Promise<SetDatabaseDirectoryResult> => {
		const validation = validateDatabaseDirectory(directory);

		if(!validation.ok) {
			return createFailure(validation.message);
		}

		const previousDirectory = location.directory;
		const switchMessage = await runExclusively(async(): Promise<string | undefined> => {
			try {
				const status = await taskStorage.openStorageDirectory(directory);

				if(status.database.state === 'healthy') {
					return undefined;
				}

				await restorePreviousDirectory(previousDirectory);

				return status.database.message || DATABASE_DIRECTORY_UNAVAILABLE_MESSAGE;
			}
			catch(error) {
				await restorePreviousDirectory(previousDirectory);

				return getErrorMessage(error);
			}
		});

		if(switchMessage) {
			return createFailure(switchMessage);
		}

		location = createConfiguredLocation(directory);

		if(persist) {
			configStore.write({ databaseDirectory: directory });
		}

		spotLogger.info('Task database folder selected', {
			type: 'config.databaseDirectory',
			previousDirectory,
			directory,
			isDevelopment: runtimePaths.isDevelopment
		});

		return {
			ok: true,
			location
		};
	};

	// Development runs always restart on the development folder, ignoring any folder selected during a previous development session
	const initializeDevelopmentLocation = async(): Promise<DatabaseLocation> => {
		try {
			ensureDatabaseDirectory(runtimePaths.defaultDatabaseDirectory);
		}
		catch(error) {
			location = createUnconfiguredLocation(getErrorMessage(error));

			return location;
		}

		const result = await applyDatabaseDirectory(runtimePaths.defaultDatabaseDirectory, { persist: true });

		if(!result.ok) {
			location = createUnconfiguredLocation(result.message);
		}

		return location;
	};

	const initializeConfiguredLocation = async(): Promise<DatabaseLocation> => {
		const savedDirectory = configStore.read().databaseDirectory;

		if(!savedDirectory) {
			location = createUnconfiguredLocation();

			return location;
		}

		const result = await applyDatabaseDirectory(savedDirectory, { persist: false });

		if(!result.ok) {
			location = createUnconfiguredLocation(result.message);
		}

		return location;
	};

	const initialize = (): Promise<DatabaseLocation> => {
		return runtimePaths.isDevelopment ? initializeDevelopmentLocation() : initializeConfiguredLocation();
	};

	const setDatabaseDirectory = (directory: string): Promise<SetDatabaseDirectoryResult> => {
		return applyDatabaseDirectory(directory, { persist: true });
	};

	const setDefaultDatabaseDirectory = async(): Promise<SetDatabaseDirectoryResult> => {
		try {
			ensureDatabaseDirectory(runtimePaths.defaultDatabaseDirectory);
		}
		catch(error) {
			return createFailure(getErrorMessage(error));
		}

		return applyDatabaseDirectory(runtimePaths.defaultDatabaseDirectory, { persist: true });
	};

	return {
		initialize,
		getLocation: () => {
			return location;
		},
		setDatabaseDirectory,
		setDefaultDatabaseDirectory
	};
};
