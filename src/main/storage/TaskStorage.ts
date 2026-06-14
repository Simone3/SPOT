import path from 'node:path';
import { createSpotLogger, type CreateSpotLoggerOptions, type SpotLogFields, type SpotLogLevel, type SpotLogger, type SpotLoggerStatus, type SpotLoggerUnavailableStatus } from 'src/main/logging/SpotLogger';
import { executeTaskCommandInStorage } from 'src/main/storage/TaskCommandExecutor';
import { DATABASE_FILE_NAME, type SqlQueryLogger, type SqlQueryLogRecord } from 'src/main/storage/TaskDatabase';
import { isInvalidTaskChangeError } from 'src/main/storage/TaskRowMapping';
import { readTasks, withTaskDatabase, type TaskSqlRepositoryOptions } from 'src/main/storage/TaskSqlRepository';
import type { Task } from 'src/types/TaskTypes';

export const STORAGE_NOT_IMPLEMENTED_MESSAGE = 'Persistent task storage is not implemented yet.';

export type PersistedTask = Omit<Task, 'visible'>;

export type PersistedTaskChange = Partial<Omit<PersistedTask, 'id'>>;

export type TaskStorageCommandName = 'task.create' | 'task.update' | 'task.delete' | 'tasks.updateMany';

interface TaskCreateCommand {
	command: 'task.create';
	payload: {
		task: PersistedTask;
	};
}

interface TaskUpdateCommand {
	command: 'task.update';
	payload: {
		taskId: string;
		change: PersistedTaskChange;
	};
}

interface TaskDeleteCommand {
	command: 'task.delete';
	payload: {
		taskId: string;
	};
}

interface TaskUpdateManyCommand {
	command: 'tasks.updateMany';
	payload: {
		reason: string;
		updates: TaskUpdateCommand['payload'][];
	};
}

export type TaskStorageCommand = TaskCreateCommand | TaskUpdateCommand | TaskDeleteCommand | TaskUpdateManyCommand;

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

export type StorageSubsystemHealth = 'not-configured' | 'healthy' | 'degraded' | 'unavailable';

export interface StorageSubsystemStatus {
	state: StorageSubsystemHealth;
	message?: string;
}

export interface StorageStatus {
	database: StorageSubsystemStatus;
	operationalLog: StorageSubsystemStatus;
	storageDirectory?: string;
	databasePath?: string;
	operationalLogPath?: string;
}

type StorageFailureReason = 'not-implemented' | 'database-error' | 'invalid-command' | 'operational-log-error';

interface StorageFailure {
	ok: false;
	reason: StorageFailureReason;
	message: string;
	status: StorageStatus;
}

export type LoadTasksResult = {
	ok: true;
	tasks: Task[];
	status: StorageStatus;
} | StorageFailure;

export type TaskStorageCommandResult = {
	ok: true;
	status: StorageStatus;
} | StorageFailure;

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
		},
		operationalLog: {
			state: 'not-configured',
			message: STORAGE_NOT_IMPLEMENTED_MESSAGE
		}
	};
};

const createConfiguredStorageStatus = (
	storageDirectory: string,
	logger: SpotLogger,
	database: StorageSubsystemStatus = { state: 'healthy' },
	operationalLog: StorageSubsystemStatus = logger.getStatus()
): StorageStatus => {
	return {
		database,
		operationalLog,
		storageDirectory,
		databasePath: path.join(storageDirectory, DATABASE_FILE_NAME),
		operationalLogPath: logger.getConfiguration().filePath
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

const createOperationalLoggingFailure = (
	storageDirectory: string,
	logger: SpotLogger,
	operationalLog: SpotLoggerUnavailableStatus
): StorageFailure => {
	return {
		ok: false,
		reason: 'operational-log-error',
		message: operationalLog.message,
		status: createConfiguredStorageStatus(storageDirectory, logger, { state: 'healthy' }, operationalLog)
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
	logger: SpotLogger,
	error: unknown,
	operationalLog: StorageSubsystemStatus = logger.getStatus()
): StorageFailure => {
	const message = getErrorMessage(error);

	return {
		ok: false,
		reason: 'database-error',
		message,
		status: createConfiguredStorageStatus(storageDirectory, logger, {
			state: 'unavailable',
			message
		}, operationalLog)
	};
};

const createInvalidCommandFailure = (
	storageDirectory: string,
	logger: SpotLogger,
	error: unknown,
	operationalLog: StorageSubsystemStatus = logger.getStatus()
): StorageFailure => {
	return {
		ok: false,
		reason: 'invalid-command',
		message: getErrorMessage(error),
		status: createConfiguredStorageStatus(storageDirectory, logger, { state: 'healthy' }, operationalLog)
	};
};

interface PendingSpotLogEntry {
	level: SpotLogLevel;
	message: string;
	fields?: SpotLogFields;
}

const createReactCommandLogEntry = (command: TaskStorageCommand): PendingSpotLogEntry => {
	return {
		level: 'info',
		message: 'React storage command received',
		fields: {
			type: 'react.command',
			command: command.command,
			payload: command.payload
		}
	};
};

const createSqlLogCollector = (entries: PendingSpotLogEntry[]): SqlQueryLogger => {
	return (record: SqlQueryLogRecord) => {
		entries.push({
			level: record.result === 'failure' ? 'error' : 'info',
			message: 'Storage SQL query completed',
			fields: {
				type: 'sql.query',
				query: record.query,
				elapsedMillis: record.durationMs,
				result: record.result,
				error: record.error
			}
		});
	};
};

const flushSpotLogEntries = async(
	logger: SpotLogger,
	entries: PendingSpotLogEntry[]
): Promise<SpotLoggerStatus> => {
	let operationalLogStatus = logger.getStatus();

	for(const entry of entries) {
		const result = await logger[entry.level](entry.message, entry.fields);
		operationalLogStatus = result.status;
	}

	return operationalLogStatus;
};

const loadConfiguredTasks = async(
	options: TaskSqlRepositoryOptions,
	logger: SpotLogger
): Promise<LoadTasksResult> => {
	const sqlLogEntries: PendingSpotLogEntry[] = [];

	try {
		const tasks = readTasks({
			...options,
			sqlLogger: createSqlLogCollector(sqlLogEntries)
		});
		const operationalLogStatus = await flushSpotLogEntries(logger, sqlLogEntries);

		return {
			ok: true,
			tasks,
			status: createConfiguredStorageStatus(options.storageDirectory, logger, { state: 'healthy' }, operationalLogStatus)
		};
	}
	catch(error) {
		const operationalLogStatus = await flushSpotLogEntries(logger, sqlLogEntries);
		return createDatabaseFailure(options.storageDirectory, logger, error, operationalLogStatus);
	}
};

const executeConfiguredTaskCommand = async(
	options: TaskSqlRepositoryOptions,
	command: TaskStorageCommand,
	logger: SpotLogger
): Promise<TaskStorageCommandResult> => {
	const reactCommandLogEntry = createReactCommandLogEntry(command);
	await logger[reactCommandLogEntry.level](reactCommandLogEntry.message, reactCommandLogEntry.fields);
	const sqlLogEntries: PendingSpotLogEntry[] = [];

	try {
		executeTaskCommandInStorage({
			...options,
			sqlLogger: createSqlLogCollector(sqlLogEntries)
		}, command);
		const operationalLogStatus = await flushSpotLogEntries(logger, sqlLogEntries);

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory, logger, { state: 'healthy' }, operationalLogStatus)
		};
	}
	catch(error) {
		const operationalLogStatus = await flushSpotLogEntries(logger, sqlLogEntries);

		if(isInvalidTaskChangeError(error)) {
			return createInvalidCommandFailure(options.storageDirectory, logger, error, operationalLogStatus);
		}

		return createDatabaseFailure(options.storageDirectory, logger, error, operationalLogStatus);
	}
};

const getConfiguredStorageStatus = async(
	options: TaskSqlRepositoryOptions,
	logger: SpotLogger
): Promise<StorageStatus> => {
	const sqlLogEntries: PendingSpotLogEntry[] = [];

	try {
		withTaskDatabase({
			...options,
			sqlLogger: createSqlLogCollector(sqlLogEntries)
		}, () => {
			return undefined;
		});
		const operationalLogStatus = await flushSpotLogEntries(logger, sqlLogEntries);

		return createConfiguredStorageStatus(options.storageDirectory, logger, { state: 'healthy' }, operationalLogStatus);
	}
	catch(error) {
		const operationalLogStatus = await flushSpotLogEntries(logger, sqlLogEntries);
		return createDatabaseFailure(options.storageDirectory, logger, error, operationalLogStatus).status;
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

	const getStorageStatus = async(): Promise<StorageStatus> => {
		if(!options.storageDirectory) {
			return createUnwiredStorageStatus();
		}

		return getConfiguredStorageStatus({
			storageDirectory: options.storageDirectory,
			now: options.now
		}, logger!);
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
		const result = await logger!.info(message, fields);

		if(!result.ok) {
			return createOperationalLoggingFailure(options.storageDirectory, logger!, result.status);
		}

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory, logger!, { state: 'healthy' }, result.status)
		};
	};

	return {
		loadTasks,
		executeTaskCommand,
		writeOperationalLogLine,
		getStorageStatus
	};
};
