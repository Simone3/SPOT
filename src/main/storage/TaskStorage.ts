import path from 'node:path';
import { executeTaskCommandInStorage } from 'src/main/storage/TaskCommandExecutor';
import { DATABASE_FILE_NAME } from 'src/main/storage/TaskDatabase';
import { isInvalidTaskChangeError } from 'src/main/storage/TaskRowMapping';
import { readTasks, withTaskDatabase, type TaskSqlRepositoryOptions } from 'src/main/storage/TaskSqlRepository';
import type { Task } from 'src/types/TaskTypes';

export const STORAGE_NOT_IMPLEMENTED_MESSAGE = 'Persistent task storage is not implemented yet.';

export const OPERATIONAL_LOG_NOT_IMPLEMENTED_MESSAGE = 'Operational logging is not implemented yet.';

export const OPERATIONAL_LOG_FILE_NAME = 'spot-logs.ndjson';

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

type StorageFailureReason = 'not-implemented' | 'database-error' | 'invalid-command';

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
	database: StorageSubsystemStatus = { state: 'healthy' }
): StorageStatus => {
	return {
		database,
		operationalLog: {
			state: 'not-configured',
			message: OPERATIONAL_LOG_NOT_IMPLEMENTED_MESSAGE
		},
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

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
};

const createDatabaseFailure = (storageDirectory: string, error: unknown): StorageFailure => {
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

const createInvalidCommandFailure = (storageDirectory: string, error: unknown): StorageFailure => {
	return {
		ok: false,
		reason: 'invalid-command',
		message: getErrorMessage(error),
		status: createConfiguredStorageStatus(storageDirectory)
	};
};

const loadConfiguredTasks = (options: TaskSqlRepositoryOptions): LoadTasksResult => {
	try {
		const tasks = readTasks(options);

		return {
			ok: true,
			tasks,
			status: createConfiguredStorageStatus(options.storageDirectory)
		};
	}
	catch(error) {
		return createDatabaseFailure(options.storageDirectory, error);
	}
};

const executeConfiguredTaskCommand = (
	options: TaskSqlRepositoryOptions,
	command: TaskStorageCommand
): TaskStorageCommandResult => {
	try {
		executeTaskCommandInStorage(options, command);

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory)
		};
	}
	catch(error) {
		if(isInvalidTaskChangeError(error)) {
			return createInvalidCommandFailure(options.storageDirectory, error);
		}

		return createDatabaseFailure(options.storageDirectory, error);
	}
};

const getConfiguredStorageStatus = (options: TaskSqlRepositoryOptions): StorageStatus => {
	try {
		withTaskDatabase(options, () => {
			return undefined;
		});

		return createConfiguredStorageStatus(options.storageDirectory);
	}
	catch(error) {
		return createDatabaseFailure(options.storageDirectory, error).status;
	}
};

export const createTaskStorage = (options: CreateTaskStorageOptions = {}): TaskStorage => {
	const getStorageStatus = (): Promise<StorageStatus> => {
		if(!options.storageDirectory) {
			return Promise.resolve(createUnwiredStorageStatus());
		}

		return Promise.resolve(getConfiguredStorageStatus({
			storageDirectory: options.storageDirectory,
			now: options.now
		}));
	};

	const loadTasks = async(): Promise<LoadTasksResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		return loadConfiguredTasks({
			storageDirectory: options.storageDirectory,
			now: options.now
		});
	};

	const executeTaskCommand = async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
		if(!options.storageDirectory) {
			return createNotImplementedFailure(await getStorageStatus());
		}

		return executeConfiguredTaskCommand({
			storageDirectory: options.storageDirectory,
			now: options.now
		}, command);
	};

	const writeOperationalLogLine = async(entry: OperationalLogEntry): Promise<OperationalLogWriteResult> => {
		void entry;

		return createNotImplementedFailure(await getStorageStatus());
	};

	return {
		loadTasks,
		executeTaskCommand,
		writeOperationalLogLine,
		getStorageStatus
	};
};
