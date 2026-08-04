import { BACKUP_CONFIG } from 'src/config/AppConfig';
import { spotLogger } from 'src/main/logging/SpotLogger';
import type { TaskStorage } from 'src/main/storage/TaskStorage';
import type { BackupStatus } from 'src/types/TaskStorageTypes';

type BackupSchedulerStorage = Pick<TaskStorage, 'createBackup'>;

export interface CreateBackupSchedulerOptions {
	taskStorage: BackupSchedulerStorage;

	// Backups run on the same chain as the task commands, so a snapshot is never taken while a write transaction is open
	runExclusively?: <TResult>(operation: () => Promise<TResult>) => Promise<TResult>;
	onBackupStatusChanged?: (status: BackupStatus) => void;
	delayAfterChangeMs?: number;
	shutdownTimeoutMs?: number;
}

export interface BackupScheduler {
	notifyTasksChanged: () => void;
	runBackupNow: () => Promise<void>;
	runFinalBackup: () => Promise<void>;
	cancelScheduledBackup: () => void;
}

const runWithTimeout = async(operation: Promise<void>, timeoutMs: number): Promise<void> => {
	let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<void>((resolve) => {
		timeoutHandle = setTimeout(resolve, timeoutMs);
	});

	try {
		await Promise.race([ operation, timeout ]);
	}
	finally {
		clearTimeout(timeoutHandle);
	}
};

// Decides when the local database is copied to the backup folder: once the task edits have been quiet for a while, and once more on shutdown.
// Backups are best effort by design, so a failing one is logged and reported but never blocks a task command or a quit.
export const createBackupScheduler = ({
	taskStorage,
	runExclusively = (operation) => {
		return operation();
	},
	onBackupStatusChanged,
	delayAfterChangeMs = BACKUP_CONFIG.delayAfterChangeMs,
	shutdownTimeoutMs = BACKUP_CONFIG.shutdownTimeoutMs
}: CreateBackupSchedulerOptions): BackupScheduler => {
	let scheduledBackup: ReturnType<typeof setTimeout> | undefined;
	let hasUnbackedUpChanges = false;
	let runningBackup: Promise<void> | undefined;

	const cancelScheduledBackup = (): void => {
		if(scheduledBackup === undefined) {
			return;
		}

		clearTimeout(scheduledBackup);
		scheduledBackup = undefined;
	};

	const runBackup = async(): Promise<void> => {
		const result = await runExclusively(() => {
			return taskStorage.createBackup();
		});

		// A backup that could not be written is worth retrying, so the changes it should have captured stay marked as pending.
		// A successful one must not clear the flag instead, because an edit made while it was running has already set it again.
		if(!result.ok) {
			hasUnbackedUpChanges = true;
		}

		onBackupStatusChanged?.(result.status);
	};

	const runBackupNow = (): Promise<void> => {
		cancelScheduledBackup();

		if(!hasUnbackedUpChanges) {
			return runningBackup ?? Promise.resolve();
		}

		// Edits made while a backup runs schedule the next one instead of starting a second overlapping backup
		hasUnbackedUpChanges = false;

		const backup = (runningBackup ?? Promise.resolve())
			.then(runBackup)
			.catch((error: unknown) => {
				hasUnbackedUpChanges = true;

				spotLogger.error('The scheduled database backup failed', {
					type: 'storage.backup',
					error: error instanceof Error ? error.message : String(error)
				});
			})
			.finally(() => {
				if(runningBackup === backup) {
					runningBackup = undefined;
				}
			});

		runningBackup = backup;

		return backup;
	};

	const notifyTasksChanged = (): void => {
		hasUnbackedUpChanges = true;
		cancelScheduledBackup();

		scheduledBackup = setTimeout(() => {
			scheduledBackup = undefined;
			void runBackupNow();
		}, delayAfterChangeMs);
	};

	// A backup folder that has become slow or unreachable must not hold up the quit: the database is the source of truth and it is already saved
	const runFinalBackup = async(): Promise<void> => {
		cancelScheduledBackup();

		await runWithTimeout(runBackupNow(), shutdownTimeoutMs);
	};

	return {
		notifyTasksChanged,
		runBackupNow,
		runFinalBackup,
		cancelScheduledBackup
	};
};
