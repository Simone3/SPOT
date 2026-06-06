import type { Task } from 'src/types/TaskTypes';

export const STORAGE_NOT_IMPLEMENTED_MESSAGE = 'Persistent task storage is not implemented yet.';

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

interface StorageFailure {
	ok: false;
	reason: 'not-implemented';
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

const createNotImplementedFailure = (): StorageFailure => {
	return {
		ok: false,
		reason: 'not-implemented',
		message: STORAGE_NOT_IMPLEMENTED_MESSAGE,
		status: createUnwiredStorageStatus()
	};
};

const loadTasks = (): Promise<LoadTasksResult> => {
	return Promise.resolve(createNotImplementedFailure());
};

const executeTaskCommand = (command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
	void command;

	return Promise.resolve(createNotImplementedFailure());
};

const writeOperationalLogLine = (entry: OperationalLogEntry): Promise<OperationalLogWriteResult> => {
	void entry;

	return Promise.resolve(createNotImplementedFailure());
};

const getStorageStatus = (): Promise<StorageStatus> => {
	return Promise.resolve(createUnwiredStorageStatus());
};

export const createTaskStorage = (): TaskStorage => {
	return {
		loadTasks,
		executeTaskCommand,
		writeOperationalLogLine,
		getStorageStatus
	};
};
