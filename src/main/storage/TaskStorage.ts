import path from 'node:path';
import { DATABASE_FILE_NAME, openTaskDatabase, type TaskDatabase } from 'src/main/storage/TaskDatabase';
import { TASK_ID_CHANGE_NOT_SUPPORTED_MESSAGE, TASK_INSERT_COLUMN_NAMES, TASK_SELECT_COLUMN_NAMES, taskChangeToTaskUpdateColumns, taskRowToColumnValues, taskRowToTask, taskToTaskRow, type TaskRow } from 'src/main/storage/TaskRowMapping';
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

interface ConfiguredTaskStorageOptions {
	storageDirectory: string;
	now?: () => Date;
}

interface InvalidTaskStorageCommandError extends Error {
	invalidTaskStorageCommand: true;
}

export { TASK_ID_CHANGE_NOT_SUPPORTED_MESSAGE };

const formatColumnList = (columnNames: readonly string[]): string => {
	return columnNames.join(', ');
};

const createParameterList = (parameterCount: number): string => {
	return Array.from({ length: parameterCount }).map(() => {
		return '?';
	}).join(', ');
};

const SELECT_TASKS_QUERY = `
	SELECT ${formatColumnList(TASK_SELECT_COLUMN_NAMES)}
	FROM tasks
	ORDER BY id ASC
`;

const INSERT_TASK_QUERY = `
	INSERT INTO tasks (${formatColumnList(TASK_INSERT_COLUMN_NAMES)})
	VALUES (${createParameterList(TASK_INSERT_COLUMN_NAMES.length)})
`;

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

const isInvalidTaskStorageCommandError = (error: unknown): error is InvalidTaskStorageCommandError => {
	if(getErrorMessage(error) === TASK_ID_CHANGE_NOT_SUPPORTED_MESSAGE) {
		return true;
	}

	return Boolean(
		error &&
		typeof error === 'object' &&
		(error as Partial<InvalidTaskStorageCommandError>).invalidTaskStorageCommand
	);
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

const withTaskDatabase = <T>(options: ConfiguredTaskStorageOptions, callback: (taskDatabase: TaskDatabase) => T): T => {
	const taskDatabase = openTaskDatabase({
		storageDirectory: options.storageDirectory,
		now: options.now
	});

	try {
		return callback(taskDatabase);
	}
	finally {
		taskDatabase.close();
	}
};

const readTaskRows = (taskDatabase: TaskDatabase): TaskRow[] => {
	return taskDatabase.connection.prepare(SELECT_TASKS_QUERY).all() as unknown as TaskRow[];
};

const runTransaction = (taskDatabase: TaskDatabase, callback: () => void): void => {
	taskDatabase.connection.exec('BEGIN');

	try {
		callback();
		taskDatabase.connection.exec('COMMIT');
	}
	catch(error) {
		taskDatabase.connection.exec('ROLLBACK');
		throw error;
	}
};

const getCurrentDate = (options: ConfiguredTaskStorageOptions): Date => {
	if(options.now) {
		return options.now();
	}

	return new Date();
};

const assertSingleTaskChanged = (changes: number | bigint, action: string, taskId: string): void => {
	if(Number(changes) !== 1) {
		throw new Error(`Cannot ${action} missing task "${taskId}".`);
	}
};

const insertTask = (taskDatabase: TaskDatabase, task: PersistedTask, writtenAt: Date): void => {
	const row = taskToTaskRow(task, {
		createdAt: writtenAt,
		updatedAt: writtenAt
	});
	const result = taskDatabase.connection.prepare(INSERT_TASK_QUERY).run(
		...taskRowToColumnValues(row, TASK_INSERT_COLUMN_NAMES)
	);

	assertSingleTaskChanged(result.changes, 'create', task.id);
};

const updateTask = (taskDatabase: TaskDatabase, taskId: string, change: PersistedTaskChange, writtenAt: Date): void => {
	const columns = taskChangeToTaskUpdateColumns(change, writtenAt);
	const assignments = columns.map((column) => {
		return `${column.columnName} = ?`;
	}).join(', ');
	const result = taskDatabase.connection.prepare(`
		UPDATE tasks
		SET ${assignments}
		WHERE id = ?
	`).run(
		...columns.map((column) => {
			return column.value;
		}),
		taskId
	);

	assertSingleTaskChanged(result.changes, 'update', taskId);
};

const deleteTask = (taskDatabase: TaskDatabase, taskId: string): void => {
	const result = taskDatabase.connection.prepare(`
		DELETE FROM tasks
		WHERE id = ?
	`).run(taskId);

	assertSingleTaskChanged(result.changes, 'delete', taskId);
};

const applyTaskCommand = (taskDatabase: TaskDatabase, command: TaskStorageCommand, writtenAt: Date): void => {
	switch(command.command) {
		case 'task.create':
			insertTask(taskDatabase, command.payload.task, writtenAt);
			break;

		case 'task.update':
			updateTask(taskDatabase, command.payload.taskId, command.payload.change, writtenAt);
			break;

		case 'task.delete':
			deleteTask(taskDatabase, command.payload.taskId);
			break;

		case 'tasks.updateMany':
			command.payload.updates.forEach((update) => {
				updateTask(taskDatabase, update.taskId, update.change, writtenAt);
			});
			break;

		default:
			throw new Error(`Unsupported task storage command "${(command as TaskStorageCommand).command}".`);
	}
};

const loadConfiguredTasks = (options: ConfiguredTaskStorageOptions): LoadTasksResult => {
	try {
		const tasks = withTaskDatabase(options, (taskDatabase) => {
			return readTaskRows(taskDatabase).map((taskRow) => {
				return taskRowToTask(taskRow);
			});
		});

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
	options: ConfiguredTaskStorageOptions,
	command: TaskStorageCommand
): TaskStorageCommandResult => {
	try {
		withTaskDatabase(options, (taskDatabase) => {
			const writtenAt = getCurrentDate(options);

			runTransaction(taskDatabase, () => {
				applyTaskCommand(taskDatabase, command, writtenAt);
			});
		});

		return {
			ok: true,
			status: createConfiguredStorageStatus(options.storageDirectory)
		};
	}
	catch(error) {
		if(isInvalidTaskStorageCommandError(error)) {
			return createInvalidCommandFailure(options.storageDirectory, error);
		}

		return createDatabaseFailure(options.storageDirectory, error);
	}
};

const getConfiguredStorageStatus = (options: ConfiguredTaskStorageOptions): StorageStatus => {
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
