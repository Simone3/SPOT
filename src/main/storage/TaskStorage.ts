import path from 'node:path';
import { DATABASE_FILE_NAME, openTaskDatabase, type TaskDatabase } from 'src/main/storage/TaskDatabase';
import { taskRowToTask, taskToTaskRow, type TaskRow } from 'src/main/storage/TaskRowMapping';
import type { Task } from 'src/types/TaskTypes';

export const STORAGE_NOT_IMPLEMENTED_MESSAGE = 'Persistent task storage is not implemented yet.';

export const OPERATIONAL_LOG_NOT_IMPLEMENTED_MESSAGE = 'Operational logging is not implemented yet.';

export const OPERATIONAL_LOG_FILE_NAME = 'spot-logs.ndjson';

export type PersistedTask = Omit<Task, 'visible'>;

export type PersistedTaskChange = Partial<PersistedTask>;

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

type StorageFailureReason = 'not-implemented' | 'database-error';

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

interface TaskUpdateColumn {
	columnName: string;
	value: string | number | null;
}

const SELECT_TASKS_QUERY = `
	SELECT
		id,
		text,
		state,
		priority,
		owner,
		due_date,
		tags_json,
		sort_position,
		completion_date,
		created_at,
		updated_at
	FROM tasks
	ORDER BY id ASC
`;

const INSERT_TASK_QUERY = `
	INSERT INTO tasks (
		id,
		text,
		state,
		priority,
		owner,
		due_date,
		tags_json,
		sort_position,
		completion_date,
		created_at,
		updated_at
	)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
		row.id,
		row.text,
		row.state,
		row.priority,
		row.owner,
		row.due_date,
		row.tags_json,
		row.sort_position,
		row.completion_date,
		row.created_at,
		row.updated_at
	);

	assertSingleTaskChanged(result.changes, 'create', task.id);
};

const hasTaskChange = <TKey extends keyof PersistedTask>(change: PersistedTaskChange, key: TKey): boolean => {
	return Object.prototype.hasOwnProperty.call(change, key);
};

const getRequiredTaskChangeValue = <TKey extends keyof PersistedTask>(
	change: PersistedTaskChange,
	key: TKey
): PersistedTask[TKey] => {
	const value = change[key];

	if(value === undefined) {
		throw new Error(`Task change field "${String(key)}" cannot be undefined.`);
	}

	return value;
};

const getTaskUpdateColumns = (change: PersistedTaskChange, updatedAt: Date): TaskUpdateColumn[] => {
	const columns: TaskUpdateColumn[] = [];

	if(hasTaskChange(change, 'id')) {
		columns.push({
			columnName: 'id',
			value: getRequiredTaskChangeValue(change, 'id')
		});
	}

	if(hasTaskChange(change, 'text')) {
		columns.push({
			columnName: 'text',
			value: getRequiredTaskChangeValue(change, 'text')
		});
	}

	if(hasTaskChange(change, 'state')) {
		columns.push({
			columnName: 'state',
			value: getRequiredTaskChangeValue(change, 'state')
		});
	}

	if(hasTaskChange(change, 'priority')) {
		columns.push({
			columnName: 'priority',
			value: getRequiredTaskChangeValue(change, 'priority')
		});
	}

	if(hasTaskChange(change, 'owner')) {
		columns.push({
			columnName: 'owner',
			value: change.owner || null
		});
	}

	if(hasTaskChange(change, 'dueDate')) {
		columns.push({
			columnName: 'due_date',
			value: change.dueDate || null
		});
	}

	if(hasTaskChange(change, 'tags')) {
		columns.push({
			columnName: 'tags_json',
			value: JSON.stringify(getRequiredTaskChangeValue(change, 'tags'))
		});
	}

	if(hasTaskChange(change, 'sortPosition')) {
		columns.push({
			columnName: 'sort_position',
			value: getRequiredTaskChangeValue(change, 'sortPosition')
		});
	}

	if(hasTaskChange(change, 'completionDate')) {
		columns.push({
			columnName: 'completion_date',
			value: change.completionDate ? change.completionDate.toISOString() : null
		});
	}

	columns.push({
		columnName: 'updated_at',
		value: updatedAt.toISOString()
	});

	return columns;
};

const updateTask = (taskDatabase: TaskDatabase, taskId: string, change: PersistedTaskChange, writtenAt: Date): void => {
	const columns = getTaskUpdateColumns(change, writtenAt);
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
