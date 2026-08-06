import { BACKUP_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { createDatabaseStorage } from 'src/framework/main/storage/DatabaseStorage';
import type { OperationalLogWriteResult } from 'src/framework/types/StorageTypes';
import type { SpotTranslator } from 'src/i18n/Translations';
import { openSpotDatabase } from 'src/main/storage/SpotDatabase';
import { executeTaskCommandOnDatabase } from 'src/main/storage/TaskCommandExecutor';
import { readTasksFromDatabase } from 'src/main/storage/TaskRepository';
import type { BackupResult, LoadTasksResult, StorageStatus, TaskStorageCommand, TaskStorageCommandName, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';
import type { Task } from 'src/types/TaskTypes';

export type { BackupHealth, BackupResult, BackupStatus, LoadTasksResult, SpotStorageApi, StorageDatabaseHealth, StorageDatabaseStatus, StorageFailure, StorageFailureReason, StorageStatus, TaskStorageCommand, TaskStorageCommandName, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';
export type { OperationalLogWriteResult } from 'src/framework/types/StorageTypes';

type ReactCommandOperationalLogEntry = {
	message: string;
	type: 'react.command';
	command: TaskStorageCommandName;
	payload: unknown;
};

type SqlQueryOperationalLogEntry = {
	message: string;
	type: 'sql.query';
	query: string;
	elapsedMillis: number;
	result: 'success' | 'failure';
	error?: string;
};

export type OperationalLogEntry = ReactCommandOperationalLogEntry | SqlQueryOperationalLogEntry;

export interface TaskStorage {
	loadTasks: () => Promise<LoadTasksResult>;
	executeTaskCommand: (command: TaskStorageCommand) => Promise<TaskStorageCommandResult>;
	writeOperationalLogLine: (entry: OperationalLogEntry) => Promise<OperationalLogWriteResult>;
	getStorageStatus: () => Promise<StorageStatus>;
	getDatabaseDirectory: () => string;
	getBackupDirectory: () => string;
	setBackupDirectory: (backupDirectory: string) => void;
	createBackup: () => Promise<BackupResult>;
	prepareForShutdown: () => Promise<void>;
}

export interface CreateTaskStorageOptions {
	databaseDirectory: string;
	backupDirectory: string;

	// Words the failure a command gets when it arrives after shutdown closed the database, which the renderer shows the user
	translator: SpotTranslator;
	now?: () => Date;
}

// Binds the framework storage core to SPOT: its database schema, its task commands, and its backup file naming
export const createTaskStorage = ({ databaseDirectory, backupDirectory, translator, now }: CreateTaskStorageOptions): TaskStorage => {
	const storage = createDatabaseStorage<TaskStorageCommand, Task>({
		databaseDirectory,
		databaseFileName: STORAGE_CONFIG.databaseFileName,
		backupDirectory,
		backupNaming: BACKUP_CONFIG,
		retainedBackupCount: BACKUP_CONFIG.retainedBackupCount,
		openDatabase: () => {
			return openSpotDatabase({
				storageDirectory: databaseDirectory,
				now
			});
		},
		readRecords: readTasksFromDatabase,
		executeCommand: (database, command) => {
			executeTaskCommandOnDatabase(database, { now }, command);
		},
		describeCommand: (command) => {
			return {
				type: 'react.command',
				command: command.command,
				payload: command.payload
			};
		},
		storageClosedMessage: translator.t('storage.closed'),
		now
	});

	const loadTasks = async(): Promise<LoadTasksResult> => {
		const result = await storage.loadRecords();

		if(!result.ok) {
			return result;
		}

		return {
			ok: true,
			tasks: result.records,
			status: result.status
		};
	};

	return {
		loadTasks,
		executeTaskCommand: storage.executeCommand,
		writeOperationalLogLine: storage.writeOperationalLogLine,
		getStorageStatus: storage.getStorageStatus,
		getDatabaseDirectory: storage.getDatabaseDirectory,
		getBackupDirectory: storage.getBackupDirectory,
		setBackupDirectory: storage.setBackupDirectory,
		createBackup: storage.createBackup,
		prepareForShutdown: storage.prepareForShutdown
	};
};
