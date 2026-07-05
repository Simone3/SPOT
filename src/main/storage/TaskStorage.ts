import path from 'node:path';
import { spotLogger } from 'src/main/logging/SpotLogger';
import { executeTaskCommandOnDatabase } from 'src/main/storage/TaskCommandExecutor';
import { DATABASE_FILE_NAME, openSpotDatabase, type SpotDatabase } from 'src/main/storage/SpotDatabase';
import { readTasksFromDatabase } from 'src/main/storage/TaskRepository';
import { isInvalidTaskChangeError } from 'src/main/storage/TaskRowMapping';
import type { LoadTasksResult, StorageDatabaseStatus, StorageFailure, StorageStatus, TaskStorageCommand, TaskStorageCommandName, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

export type { LoadTasksResult, SpotStorageApi, StorageDatabaseHealth, StorageDatabaseStatus, StorageFailure, StorageFailureReason, StorageStatus, TaskStorageCommand, TaskStorageCommandName, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

export const STORAGE_NOT_IMPLEMENTED_MESSAGE = 'Persistent task storage is not implemented yet.';

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
	prepareForShutdown: () => Promise<void>;
}

export interface CreateTaskStorageOptions {
	storageDirectory?: string;
	now?: () => Date;
}

interface ConfiguredTaskStorageDatabase {
	getDatabase: () => SpotDatabase;
	close: () => void;
}

const createUnwiredStorageStatus = (): StorageStatus => {
	return {
		database: {
			state: 'not-configured',
			message: STORAGE_NOT_IMPLEMENTED_MESSAGE
		}
	};
};

const createConfiguredStorageStatus = (
	storageDirectory: string,
	database: StorageDatabaseStatus = { state: 'healthy' }
): StorageStatus => {
	return {
		database,
		storageDirectory,
		databasePath: path.join(storageDirectory, DATABASE_FILE_NAME)
	};
};

const createNotImplementedFailure = (status: StorageStatus): StorageFailure => {
	return {
		ok: false,
		reason: 'not-implemented',
		message: STORAGE_NOT_IMPLEMENTED_MESSAGE,
		status
	};
};

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
};

const createDatabaseFailure = (
	storageDirectory: string,
	error: unknown
): StorageFailure => {
	const message = getErrorMessage(error);

	return {
		ok: false,
		reason: 'database-error',
		message,
		status: createConfiguredStorageStatus(storageDirectory, {
			state: 'unavailable',
			message
		})
	};
};

const createInvalidCommandFailure = (
	storageDirectory: string,
	error: unknown
): StorageFailure => {
	return {
		ok: false,
		reason: 'invalid-command',
		message: getErrorMessage(error),
		status: createConfiguredStorageStatus(storageDirectory, { state: 'healthy' })
	};
};

const writeReactCommandLogEntry = (command: TaskStorageCommand): void => {
	spotLogger.info('React storage command received', {
		type: 'react.command',
		command: command.command,
		payload: command.payload
	});
};

const createConfiguredTaskStorageDatabase = (
	storageDirectory: string,
	now: (() => Date) | undefined
): ConfiguredTaskStorageDatabase => {
	let spotDatabase: SpotDatabase | undefined;

	const getDatabase = (): SpotDatabase => {
		if(!spotDatabase) {
			spotDatabase = openSpotDatabase({
				storageDirectory,
				now
			});
		}

		return spotDatabase;
	};

	const close = (): void => {
		if(!spotDatabase) {
			return;
		}

		const databaseToClose = spotDatabase;
		spotDatabase = undefined;
		databaseToClose.close();
	};

	return {
		getDatabase,
		close
	};
};

const loadConfiguredTasks = (
	storageDirectory: string,
	database: ConfiguredTaskStorageDatabase
): LoadTasksResult => {
	try {
		const tasks = readTasksFromDatabase(database.getDatabase());

		return {
			ok: true,
			tasks,
			status: createConfiguredStorageStatus(storageDirectory, { state: 'healthy' })
		};
	}
	catch(error) {
		return createDatabaseFailure(storageDirectory, error);
	}
};

const executeConfiguredTaskCommand = (
	storageDirectory: string,
	now: (() => Date) | undefined,
	database: ConfiguredTaskStorageDatabase,
	command: TaskStorageCommand
): TaskStorageCommandResult => {
	writeReactCommandLogEntry(command);

	try {
		executeTaskCommandOnDatabase(database.getDatabase(), { now }, command);

		return {
			ok: true,
			status: createConfiguredStorageStatus(storageDirectory, { state: 'healthy' })
		};
	}
	catch(error) {
		if(isInvalidTaskChangeError(error)) {
			return createInvalidCommandFailure(storageDirectory, error);
		}

		return createDatabaseFailure(storageDirectory, error);
	}
};

const getConfiguredStorageStatus = (
	storageDirectory: string,
	database: ConfiguredTaskStorageDatabase
): StorageStatus => {
	try {
		database.getDatabase();

		return createConfiguredStorageStatus(storageDirectory, { state: 'healthy' });
	}
	catch(error) {
		return createDatabaseFailure(storageDirectory, error).status;
	}
};

export const createTaskStorage = (options: CreateTaskStorageOptions = {}): TaskStorage => {
	let database: ConfiguredTaskStorageDatabase | undefined;

	if(options.storageDirectory) {
		database = createConfiguredTaskStorageDatabase(options.storageDirectory, options.now);
	}

	const getStorageStatus = (): Promise<StorageStatus> => {
		if(!options.storageDirectory) {
			return Promise.resolve(createUnwiredStorageStatus());
		}

		return Promise.resolve(getConfiguredStorageStatus(options.storageDirectory, database!));
	};

	const loadTasks = async(): Promise<LoadTasksResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		return loadConfiguredTasks(options.storageDirectory, database!);
	};

	const executeTaskCommand = async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		return executeConfiguredTaskCommand(options.storageDirectory, options.now, database!, command);
	};

	const writeOperationalLogLine = async(entry: OperationalLogEntry): Promise<OperationalLogWriteResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		const { message, ...fields } = entry;
		spotLogger.info(message, fields);

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' })
		};
	};

	const prepareForShutdown = (): Promise<void> => {
		database?.close();

		return Promise.resolve();
	};

	return {
		loadTasks,
		executeTaskCommand,
		writeOperationalLogLine,
		getStorageStatus,
		prepareForShutdown
	};
};
