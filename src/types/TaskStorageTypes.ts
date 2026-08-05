import type { BackupStatus, StorageCommandResult, StorageFailure, StorageStatus } from 'src/framework/types/StorageTypes';
import type { PersistedTask, PersistedTaskChange, Task } from 'src/types/TaskTypes';

// The storage envelope is framework-owned: only the commands and the loaded records are SPOT concepts
export type { BackupHealth, BackupResult, BackupStatus, StorageDatabaseHealth, StorageDatabaseStatus, StorageFailure, StorageFailureReason, StorageStatus } from 'src/framework/types/StorageTypes';

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

export type LoadTasksResult = {
	ok: true;
	tasks: Task[];
	status: StorageStatus;
} | StorageFailure;

export type TaskStorageCommandResult = StorageCommandResult;

export interface SpotStorageApi {
	loadTasks: () => Promise<LoadTasksResult>;
	executeTaskCommand: (command: TaskStorageCommand) => Promise<TaskStorageCommandResult>;
	getStorageStatus: () => Promise<StorageStatus>;

	// Subscribes to the main-process request to save the task changes still buffered in the renderer, and returns the unsubscribe callback
	onFlushPendingTaskChanges: (listener: () => void) => () => void;

	// Backups run on a timer, long after the command that triggered them answered, so their outcome is pushed instead of being waited for
	onBackupStatusChanged: (listener: (status: BackupStatus) => void) => () => void;

	// Tells the main process that the buffered task changes reached storage, so that shutdown can continue
	notifyPendingTaskChangesFlushed: () => Promise<void>;
}
