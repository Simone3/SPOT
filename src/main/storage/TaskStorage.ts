import path from 'node:path';
import { createSpotLogger, type CreateSpotLoggerOptions, type SpotLogger } from 'src/main/logging/SpotLogger';
import { executeTaskCommandInStorage } from 'src/main/storage/TaskCommandExecutor';
import { DATABASE_FILE_NAME, type SqlQueryLogger } from 'src/main/storage/SpotDatabase';
import { readTasks, withSpotDatabase, type TaskRepositoryOptions } from 'src/main/storage/TaskRepository';
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
}

export interface CreateTaskStorageOptions {
	storageDirectory?: string;
	now?: () => Date;
	logger?: Omit<CreateSpotLoggerOptions, 'storageDirectory'>;
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

const writeReactCommandLogEntry = (
	logger: SpotLogger,
	command: TaskStorageCommand
): void => {
	logger.info('React storage command received', {
		type: 'react.command',
		command: command.command,
		payload: command.payload
	});
};

const createSqlLogger = (logger: SpotLogger): SqlQueryLogger => {
	return (record) => {
		logger[record.result === 'failure' ? 'error' : 'info']('Storage SQL query completed', {
			type: 'sql.query',
			query: record.query,
			elapsedMillis: record.durationMs,
			result: record.result,
			error: record.error
		});
	};
};

const loadConfiguredTasks = (
	options: TaskRepositoryOptions,
	logger: SpotLogger
): LoadTasksResult => {
	try {
		const tasks = readTasks({
			...options,
			sqlLogger: createSqlLogger(logger)
		});

		return {
			ok: true,
			tasks,
			status: createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' })
		};
	}
	catch(error) {
		return createDatabaseFailure(options.storageDirectory, error);
	}
};

const executeConfiguredTaskCommand = (
	options: TaskRepositoryOptions,
	command: TaskStorageCommand,
	logger: SpotLogger
): TaskStorageCommandResult => {
	writeReactCommandLogEntry(logger, command);

	try {
		executeTaskCommandInStorage({
			...options,
			sqlLogger: createSqlLogger(logger)
		}, command);

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' })
		};
	}
	catch(error) {
		if(isInvalidTaskChangeError(error)) {
			return createInvalidCommandFailure(options.storageDirectory, error);
		}

		return createDatabaseFailure(options.storageDirectory, error);
	}
};

const getConfiguredStorageStatus = (
	options: TaskRepositoryOptions,
	logger: SpotLogger
): StorageStatus => {
	try {
		withSpotDatabase({
			...options,
			sqlLogger: createSqlLogger(logger)
		}, () => {
			return undefined;
		});

		return createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' });
	}
	catch(error) {
		return createDatabaseFailure(options.storageDirectory, error).status;
	}
};

export const createTaskStorage = (options: CreateTaskStorageOptions = {}): TaskStorage => {
	let logger: SpotLogger | undefined;

	if(options.storageDirectory) {
		logger = createSpotLogger({
			storageDirectory: options.storageDirectory,
			now: options.now,
			...options.logger
		});
	}

	const getStorageStatus = (): Promise<StorageStatus> => {
		if(!options.storageDirectory) {
			return Promise.resolve(createUnwiredStorageStatus());
		}

		return Promise.resolve(getConfiguredStorageStatus({
			storageDirectory: options.storageDirectory,
			now: options.now
		}, logger!));
	};

	const loadTasks = async(): Promise<LoadTasksResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		return loadConfiguredTasks({
			storageDirectory: options.storageDirectory,
			now: options.now
		}, logger!);
	};

	const executeTaskCommand = async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		return executeConfiguredTaskCommand({
			storageDirectory: options.storageDirectory,
			now: options.now
		}, command, logger!);
	};

	const writeOperationalLogLine = async(entry: OperationalLogEntry): Promise<OperationalLogWriteResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		const { message, ...fields } = entry;
		logger!.info(message, fields);

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' })
		};
	};

	return {
		loadTasks,
		executeTaskCommand,
		writeOperationalLogLine,
		getStorageStatus
	};
};
