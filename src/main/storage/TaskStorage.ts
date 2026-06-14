import path from 'node:path';
import { executeTaskCommandInStorage } from 'src/main/storage/TaskCommandExecutor';
import { DATABASE_FILE_NAME, type SqlQueryLogger, type SqlQueryLogRecord } from 'src/main/storage/TaskDatabase';
import { createOperationalLog, OPERATIONAL_LOG_FILE_NAME, OPERATIONAL_LOG_WRITE_FAILED_MESSAGE, type CreateOperationalLogOptions, type OperationalLog, type OperationalLogStatus } from 'src/main/storage/OperationalLog';
import { isInvalidTaskChangeError } from 'src/main/storage/TaskRowMapping';
import { readTasks, withTaskDatabase, type TaskSqlRepositoryOptions } from 'src/main/storage/TaskSqlRepository';
import type { Task } from 'src/types/TaskTypes';

export const STORAGE_NOT_IMPLEMENTED_MESSAGE = 'Persistent task storage is not implemented yet.';

export { OPERATIONAL_LOG_FILE_NAME };

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
	createdAt: string;
	type: 'react.command';
	command: TaskStorageCommandName;
	payload: unknown;
}

interface SqlQueryOperationalLogEntry {
	createdAt: string;
	type: 'sql.query';
	query: string;
	durationMs: number;
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
	operationalLog?: Omit<CreateOperationalLogOptions, 'storageDirectory'>;
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
	database: StorageSubsystemStatus = { state: 'healthy' },
	operationalLog: StorageSubsystemStatus = { state: 'healthy' }
): StorageStatus => {
	return {
		database,
		operationalLog,
		storageDirectory,
		databasePath: path.join(storageDirectory, DATABASE_FILE_NAME),
		operationalLogPath: path.join(storageDirectory, OPERATIONAL_LOG_FILE_NAME)
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

const createOperationalLogFailure = (
	storageDirectory: string,
	operationalLog: OperationalLogStatus
): StorageFailure => {
	return {
		ok: false,
		reason: 'operational-log-error',
		message: operationalLog.message ?? OPERATIONAL_LOG_WRITE_FAILED_MESSAGE,
		status: createConfiguredStorageStatus(storageDirectory, { state: 'healthy' }, operationalLog)
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
	error: unknown,
	operationalLog: StorageSubsystemStatus = { state: 'healthy' }
): StorageFailure => {
	const message = getErrorMessage(error);

	return {
		ok: false,
		reason: 'database-error',
		message,
		status: createConfiguredStorageStatus(storageDirectory, {
			state: 'unavailable',
			message
		}, operationalLog)
	};
};

const createInvalidCommandFailure = (
	storageDirectory: string,
	error: unknown,
	operationalLog: StorageSubsystemStatus = { state: 'healthy' }
): StorageFailure => {
	return {
		ok: false,
		reason: 'invalid-command',
		message: getErrorMessage(error),
		status: createConfiguredStorageStatus(storageDirectory, { state: 'healthy' }, operationalLog)
	};
};

const getTimestamp = (now?: () => Date): string => {
	if(now) {
		return now().toISOString();
	}

	return new Date().toISOString();
};

const createReactCommandLogEntry = (command: TaskStorageCommand, now?: () => Date): OperationalLogEntry => {
	return {
		createdAt: getTimestamp(now),
		type: 'react.command',
		command: command.command,
		payload: command.payload
	};
};

const createSqlLogCollector = (entries: OperationalLogEntry[], now?: () => Date): SqlQueryLogger => {
	return (record: SqlQueryLogRecord) => {
		entries.push({
			createdAt: getTimestamp(now),
			type: 'sql.query',
			query: record.query,
			durationMs: record.durationMs,
			result: record.result,
			error: record.error
		});
	};
};

const flushOperationalLogEntries = async(
	operationalLog: OperationalLog,
	entries: OperationalLogEntry[]
): Promise<OperationalLogStatus> => {
	let operationalLogStatus = operationalLog.getStatus();

	for(const entry of entries) {
		const result = await operationalLog.writeEntry(entry);
		operationalLogStatus = result.status;
	}

	return operationalLogStatus;
};

const loadConfiguredTasks = async(
	options: TaskSqlRepositoryOptions,
	operationalLog: OperationalLog
): Promise<LoadTasksResult> => {
	const sqlLogEntries: OperationalLogEntry[] = [];

	try {
		const tasks = readTasks({
			...options,
			sqlLogger: createSqlLogCollector(sqlLogEntries, options.now)
		});
		const operationalLogStatus = await flushOperationalLogEntries(operationalLog, sqlLogEntries);

		return {
			ok: true,
			tasks,
			status: createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' }, operationalLogStatus)
		};
	}
	catch(error) {
		const operationalLogStatus = await flushOperationalLogEntries(operationalLog, sqlLogEntries);
		return createDatabaseFailure(options.storageDirectory, error, operationalLogStatus);
	}
};

const executeConfiguredTaskCommand = async(
	options: TaskSqlRepositoryOptions,
	command: TaskStorageCommand,
	operationalLog: OperationalLog
): Promise<TaskStorageCommandResult> => {
	await operationalLog.writeEntry(createReactCommandLogEntry(command, options.now));
	const sqlLogEntries: OperationalLogEntry[] = [];

	try {
		executeTaskCommandInStorage({
			...options,
			sqlLogger: createSqlLogCollector(sqlLogEntries, options.now)
		}, command);
		const operationalLogStatus = await flushOperationalLogEntries(operationalLog, sqlLogEntries);

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' }, operationalLogStatus)
		};
	}
	catch(error) {
		const operationalLogStatus = await flushOperationalLogEntries(operationalLog, sqlLogEntries);

		if(isInvalidTaskChangeError(error)) {
			return createInvalidCommandFailure(options.storageDirectory, error, operationalLogStatus);
		}

		return createDatabaseFailure(options.storageDirectory, error, operationalLogStatus);
	}
};

const getConfiguredStorageStatus = async(
	options: TaskSqlRepositoryOptions,
	operationalLog: OperationalLog
): Promise<StorageStatus> => {
	const sqlLogEntries: OperationalLogEntry[] = [];

	try {
		withTaskDatabase({
			...options,
			sqlLogger: createSqlLogCollector(sqlLogEntries, options.now)
		}, () => {
			return undefined;
		});
		const operationalLogStatus = await flushOperationalLogEntries(operationalLog, sqlLogEntries);

		return createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' }, operationalLogStatus);
	}
	catch(error) {
		const operationalLogStatus = await flushOperationalLogEntries(operationalLog, sqlLogEntries);
		return createDatabaseFailure(options.storageDirectory, error, operationalLogStatus).status;
	}
};

export const createTaskStorage = (options: CreateTaskStorageOptions = {}): TaskStorage => {
	let operationalLog: OperationalLog | undefined;

	if(options.storageDirectory) {
		operationalLog = createOperationalLog({
			storageDirectory: options.storageDirectory,
			...options.operationalLog
		});
	}

	const getStorageStatus = async(): Promise<StorageStatus> => {
		if(!options.storageDirectory) {
			return createUnwiredStorageStatus();
		}

		return getConfiguredStorageStatus({
			storageDirectory: options.storageDirectory,
			now: options.now
		}, operationalLog!);
	};

	const loadTasks = async(): Promise<LoadTasksResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		return loadConfiguredTasks({
			storageDirectory: options.storageDirectory,
			now: options.now
		}, operationalLog!);
	};

	const executeTaskCommand = async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		return executeConfiguredTaskCommand({
			storageDirectory: options.storageDirectory,
			now: options.now
		}, command, operationalLog!);
	};

	const writeOperationalLogLine = async(entry: OperationalLogEntry): Promise<OperationalLogWriteResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		const result = await operationalLog!.writeEntry(entry);

		if(!result.ok) {
			return createOperationalLogFailure(options.storageDirectory, result.status);
		}

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory, { state: 'healthy' }, result.status)
		};
	};

	return {
		loadTasks,
		executeTaskCommand,
		writeOperationalLogLine,
		getStorageStatus
	};
};
