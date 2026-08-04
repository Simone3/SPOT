import { BACKUP_CONFIG } from 'src/config/AppConfig';
import { resetSpotLoggerForTests } from 'src/main/logging/SpotLogger';
import { createBackupScheduler } from 'src/main/storage/BackupScheduler';
import type { BackupResult, BackupStatus } from 'src/types/TaskStorageTypes';

const BACKUP_DIRECTORY = '/tmp/spot-backups';

const createSuccessfulBackup = (): BackupResult => {
	return {
		ok: true,
		backupPath: `${BACKUP_DIRECTORY}/spot-backup.sqlite`,
		status: {
			state: 'ok',
			directory: BACKUP_DIRECTORY,
			lastBackupAt: '2026-06-06T10:00:00.000Z'
		}
	};
};

const createFailedBackup = (): BackupResult => {
	return {
		ok: false,
		message: 'The backup folder is not available.',
		status: {
			state: 'failed',
			directory: BACKUP_DIRECTORY,
			message: 'The backup folder is not available.'
		}
	};
};

const createFakeTaskStorage = (results: BackupResult[] = []): {
	createBackup: jest.Mock<Promise<BackupResult>, []>;
} => {
	return {
		createBackup: jest.fn(() => {
			return Promise.resolve(results.shift() ?? createSuccessfulBackup());
		})
	};
};

describe('BackupScheduler', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		resetSpotLoggerForTests();
	});

	test('waits for the task changes to settle before backing up', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createBackupScheduler({ taskStorage });

		scheduler.notifyTasksChanged();
		jest.advanceTimersByTime(BACKUP_CONFIG.delayAfterChangeMs - 1);

		expect(taskStorage.createBackup).not.toHaveBeenCalled();

		// A later change restarts the wait instead of adding a second backup
		scheduler.notifyTasksChanged();
		jest.advanceTimersByTime(BACKUP_CONFIG.delayAfterChangeMs - 1);

		expect(taskStorage.createBackup).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		await scheduler.runBackupNow();

		expect(taskStorage.createBackup).toHaveBeenCalledTimes(1);
	});

	test('does not back up again when nothing changed since the last backup', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createBackupScheduler({ taskStorage });

		scheduler.notifyTasksChanged();
		await scheduler.runBackupNow();
		await scheduler.runBackupNow();

		expect(taskStorage.createBackup).toHaveBeenCalledTimes(1);
	});

	test('reports the outcome of every backup it runs', async() => {
		const taskStorage = createFakeTaskStorage([ createFailedBackup(), createSuccessfulBackup() ]);
		const reportedStatuses: BackupStatus[] = [];
		const scheduler = createBackupScheduler({
			taskStorage,
			onBackupStatusChanged: (status) => {
				reportedStatuses.push(status);
			}
		});

		scheduler.notifyTasksChanged();
		await scheduler.runBackupNow();

		// The failed backup left the changes pending, so the next run retries them without a new task change
		await scheduler.runBackupNow();

		expect(reportedStatuses.map((status) => {
			return status.state;
		})).toEqual([ 'failed', 'ok' ]);
	});

	test('runs backups on the storage chain', async() => {
		const taskStorage = createFakeTaskStorage();
		const trackExclusiveRun = jest.fn();
		const runExclusively = <TResult>(operation: () => Promise<TResult>): Promise<TResult> => {
			trackExclusiveRun();

			return operation();
		};
		const scheduler = createBackupScheduler({ taskStorage, runExclusively });

		scheduler.notifyTasksChanged();
		await scheduler.runBackupNow();

		expect(trackExclusiveRun).toHaveBeenCalledTimes(1);
	});

	test('backs up once more on shutdown and cancels the pending schedule', async() => {
		const taskStorage = createFakeTaskStorage();
		const scheduler = createBackupScheduler({ taskStorage });

		scheduler.notifyTasksChanged();
		await scheduler.runFinalBackup();

		expect(taskStorage.createBackup).toHaveBeenCalledTimes(1);

		jest.advanceTimersByTime(BACKUP_CONFIG.delayAfterChangeMs);

		expect(taskStorage.createBackup).toHaveBeenCalledTimes(1);
	});

	// The database is the source of truth and is already saved, so a backup folder that stopped answering must not block the quit
	test('gives up on a shutdown backup that takes too long', async() => {
		let finishBackup: (() => void) | undefined;
		const taskStorage = {
			createBackup: jest.fn(() => {
				return new Promise<BackupResult>((resolve) => {
					finishBackup = () => {
						resolve(createSuccessfulBackup());
					};
				});
			})
		};
		const scheduler = createBackupScheduler({ taskStorage, shutdownTimeoutMs: 5000 });

		scheduler.notifyTasksChanged();

		const finalBackup = scheduler.runFinalBackup();
		jest.advanceTimersByTime(5000);

		await expect(finalBackup).resolves.toBeUndefined();
		expect(finishBackup).toBeDefined();
	});
});
