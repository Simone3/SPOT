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

// The backup folder is a write-only destination for rotated copies, so a failing backup never means the tasks themselves are at risk
export type BackupHealth = 'idle' | 'ok' | 'failed';

export interface BackupStatus {
	state: BackupHealth;
	directory: string;
	lastBackupAt?: string;
	lastBackupPath?: string;
	message?: string;
}

export type BackupResult = {
	ok: true;
	backupPath: string;
	status: BackupStatus;
} | {
	ok: false;
	message: string;
	status: BackupStatus;
};

export interface StorageStatus {
	database: StorageDatabaseStatus;
	storageDirectory?: string;
	databasePath?: string;
	backup?: BackupStatus;
}

export type StorageFailureReason = 'not-implemented' | 'database-error' | 'invalid-command' | 'shutdown';

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

	// Subscribes to the main-process request to save the task changes still buffered in the renderer, and returns the unsubscribe callback
	onFlushPendingTaskChanges: (listener: () => void) => () => void;

	// Backups run on a timer, long after the command that triggered them answered, so their outcome is pushed instead of being waited for
	onBackupStatusChanged: (listener: (status: BackupStatus) => void) => () => void;

	// Tells the main process that the buffered task changes reached storage, so that shutdown can continue
	notifyPendingTaskChangesFlushed: () => Promise<void>;
}
