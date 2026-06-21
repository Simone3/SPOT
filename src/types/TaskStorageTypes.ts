import type { PersistedTask, PersistedTaskChange, Task } from 'src/types/TaskTypes';

export type TaskStorageCommandName = 'task.create' | 'task.update' | 'task.delete' | 'tasks.updateMany';

export interface TaskCreateCommand {
	command: 'task.create';
	payload: {
		task: PersistedTask;
	};
}

export interface TaskUpdateCommand {
	command: 'task.update';
	payload: {
		taskId: string;
		change: PersistedTaskChange;
	};
}

export interface TaskDeleteCommand {
	command: 'task.delete';
	payload: {
		taskId: string;
	};
}

export interface TaskUpdateManyCommand {
	command: 'tasks.updateMany';
	payload: {
		reason: string;
		updates: TaskUpdateCommand['payload'][];
	};
}

export type TaskStorageCommand = TaskCreateCommand | TaskUpdateCommand | TaskDeleteCommand | TaskUpdateManyCommand;

export type StorageDatabaseHealth = 'not-configured' | 'healthy' | 'unavailable';

export interface StorageDatabaseStatus {
	state: StorageDatabaseHealth;
	message?: string;
}

export interface StorageStatus {
	database: StorageDatabaseStatus;
	storageDirectory?: string;
	databasePath?: string;
}

export type StorageFailureReason = 'not-implemented' | 'database-error' | 'invalid-command';

export interface StorageFailure {
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

export interface SpotStorageApi {
	loadTasks: () => Promise<LoadTasksResult>;
	executeTaskCommand: (command: TaskStorageCommand) => Promise<TaskStorageCommandResult>;
	getStorageStatus: () => Promise<StorageStatus>;
}
