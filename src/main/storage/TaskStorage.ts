import path from 'node:path';
import { STORAGE_CONFIG } from 'src/config/AppConfig';
import { spotLogger } from 'src/main/logging/SpotLogger';
import { createDatabaseBackup } from 'src/main/storage/DatabaseBackup';
import { executeTaskCommandOnDatabase } from 'src/main/storage/TaskCommandExecutor';
import { openSpotDatabase, type SpotDatabase } from 'src/main/storage/SpotDatabase';
import { readTasksFromDatabase } from 'src/main/storage/TaskRepository';
import { isInvalidTaskChangeError } from 'src/main/storage/TaskRowMapping';
import type { BackupResult, BackupStatus, LoadTasksResult, StorageDatabaseStatus, StorageFailure, StorageStatus, TaskStorageCommand, TaskStorageCommandName, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

export type { BackupHealth, BackupResult, BackupStatus, LoadTasksResult, SpotStorageApi, StorageDatabaseHealth, StorageDatabaseStatus, StorageFailure, StorageFailureReason, StorageStatus, TaskStorageCommand, TaskStorageCommandName, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

interface ReactCommandOperationalLogEntry {
	message: string;
	type: 'react.command';
	command: TaskStorageCommandName;
	payload: unknown;
}

interface SqlQueryOperationalLogEntry {
	message: string;
	type: 'sql.query';
	query: string;
	elapsedMillis: number;
	result: 'success' | 'failure';
	error?: string;
}

export type OperationalLogEntry = ReactCommandOperationalLogEntry | SqlQueryOperationalLogEntry;

export type OperationalLogWriteResult = {
	ok: true;
	status: StorageStatus;
} | StorageFailure;

export interface TaskStorage {
	loadTasks: () => Promise<LoadTasksResult>;
	executeTaskCommand: (command: TaskStorageCommand) => Promise<TaskStorageCommandResult>;
	writeOperationalLogLine: (entry: OperationalLogEntry) => Promise<OperationalLogWriteResult>;
	getStorageStatus: () => Promise<StorageStatus>;
	getDatabaseDirectory: () => string;
	getBackupDirectory: () => string;
	setBackupDirectory: (backupDirectory: string) => void;
	createBackup: () => Promise<BackupResult>;
	prepareForShutdown: () => Promise<void>;
}

export interface CreateTaskStorageOptions {
	databaseDirectory: string;
	backupDirectory: string;
	now?: () => Date;
}

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
};

const writeReactCommandLogEntry = (command: TaskStorageCommand): void => {
	spotLogger.info('React storage command received', {
		type: 'react.command',
		command: command.command,
		payload: command.payload
	});
};

// Owns the one database SPOT reads and writes. It always lives in the local database directory: the backup directory only receives rotated
// copies, so it can never become the source of truth.
export const createTaskStorage = ({ databaseDirectory, backupDirectory: initialBackupDirectory, now }: CreateTaskStorageOptions): TaskStorage => {
	let spotDatabase: SpotDatabase | undefined;
	let backupDirectory = initialBackupDirectory;
	let backupStatus: BackupStatus = {
		state: 'idle',
		directory: initialBackupDirectory
	};

	const getCurrentDate = (): Date => {
		return now ? now() : new Date();
	};

	const getDatabase = (): SpotDatabase => {
		if(!spotDatabase) {
			spotDatabase = openSpotDatabase({
				storageDirectory: databaseDirectory,
				now
			});
		}

		return spotDatabase;
	};

	const createStatus = (database: StorageDatabaseStatus = { state: 'healthy' }): StorageStatus => {
		return {
			database,
			storageDirectory: databaseDirectory,
			databasePath: path.join(databaseDirectory, STORAGE_CONFIG.databaseFileName),
			backup: backupStatus
		};
	};

	const createDatabaseFailure = (error: unknown): StorageFailure => {
		const message = getErrorMessage(error);

		return {
			ok: false,
			reason: 'database-error',
			message,
			status: createStatus({
				state: 'unavailable',
				message
			})
		};
	};

	const createInvalidCommandFailure = (error: unknown): StorageFailure => {
		return {
			ok: false,
			reason: 'invalid-command',
			message: getErrorMessage(error),
			status: createStatus()
		};
	};

	const loadTasks = (): Promise<LoadTasksResult> => {
		try {
			return Promise.resolve({
				ok: true,
				tasks: readTasksFromDatabase(getDatabase()),
				status: createStatus()
			});
		}
		catch(error) {
			return Promise.resolve(createDatabaseFailure(error));
		}
	};

	const executeTaskCommand = (command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
		writeReactCommandLogEntry(command);

		try {
			executeTaskCommandOnDatabase(getDatabase(), { now }, command);

			return Promise.resolve({
				ok: true,
				status: createStatus()
			});
		}
		catch(error) {
			if(isInvalidTaskChangeError(error)) {
				return Promise.resolve(createInvalidCommandFailure(error));
			}

			return Promise.resolve(createDatabaseFailure(error));
		}
	};

	const writeOperationalLogLine = (entry: OperationalLogEntry): Promise<OperationalLogWriteResult> => {
		const { message, ...fields } = entry;
		spotLogger.info(message, fields);

		return Promise.resolve({
			ok: true,
			status: createStatus()
		});
	};

	// A failed backup is reported without touching the database status: the tasks are already saved in the local database either way
	const createBackup = async(): Promise<BackupResult> => {
		try {
			const backupPath = await createDatabaseBackup({
				database: getDatabase(),
				backupDirectory,
				temporaryDirectory: databaseDirectory,
				now
			});

			backupStatus = {
				state: 'ok',
				directory: backupDirectory,
				lastBackupAt: getCurrentDate().toISOString(),
				lastBackupPath: backupPath
			};

			spotLogger.info('Database backup written', {
				type: 'storage.backup',
				backupPath
			});

			return {
				ok: true,
				backupPath,
				status: backupStatus
			};
		}
		catch(error) {
			const message = getErrorMessage(error);

			backupStatus = {
				state: 'failed',
				directory: backupDirectory,
				lastBackupAt: backupStatus.lastBackupAt,
				lastBackupPath: backupStatus.lastBackupPath,
				message
			};

			spotLogger.error('Could not write the database backup', {
				type: 'storage.backup',
				backupDirectory,
				error: message
			});

			return {
				ok: false,
				message,
				status: backupStatus
			};
		}
	};

	// The previous folder keeps the copies it already received, and the status starts over because nothing was written to the new one yet
	const setBackupDirectory = (nextBackupDirectory: string): void => {
		backupDirectory = nextBackupDirectory;
		backupStatus = {
			state: 'idle',
			directory: nextBackupDirectory
		};
	};

	const prepareForShutdown = (): Promise<void> => {
		const databaseToClose = spotDatabase;
		spotDatabase = undefined;
		databaseToClose?.close();

		return Promise.resolve();
	};

	return {
		loadTasks,
		executeTaskCommand,
		writeOperationalLogLine,
		getStorageStatus: () => {
			try {
				getDatabase();

				return Promise.resolve(createStatus());
			}
			catch(error) {
				return Promise.resolve(createDatabaseFailure(error).status);
			}
		},
		getDatabaseDirectory: () => {
			return databaseDirectory;
		},
		getBackupDirectory: () => {
			return backupDirectory;
		},
		setBackupDirectory,
		createBackup,
		prepareForShutdown
	};
};
