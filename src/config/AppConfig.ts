/**
 * App-wide configuration values.
 * Centralizes tunable constants (sizes, delays, retry policies, file and directory names) instead of spreading them as magic numbers across modules.
 * This file is shared by the Electron main process and the React renderer, so it must stay free of Node and Electron imports.
 */

export const WINDOW_CONFIG = {
	widthPixels: 800,
	heightPixels: 600,
	preloadScriptFileName: 'preload.js',
	reactBuildIndexPathSegments: [ 'build', 'index.html' ]
} as const;

export const STORAGE_CONFIG = {
	directoryName: 'storage',
	databaseFileName: 'spot.sqlite',
	currentSchemaVersion: 1,
	databaseTimeoutMs: 5000,
	writeRetryDelayMs: 5000,

	// A database error the retries cannot fix, such as a full disk, would otherwise keep the failed write at the front of the queue and leave
	// every later change unwritten for the rest of the session, so the retries are bounded and the change is then reported as lost
	maximumWriteAttempts: 5
} as const;

export const BACKUP_CONFIG = {
	directoryName: 'backups',
	filePrefix: 'spot-backup-',
	fileExtension: '.sqlite',
	partialFileExtension: '.part',
	temporaryFileName: 'spot-backup.tmp.sqlite',
	delayAfterChangeMs: 120000,
	retainedBackupCount: 5,
	shutdownTimeoutMs: 5000
} as const;

export const APP_CONFIG_FILE = {
	developmentDirectoryName: 'dev',
	fileName: 'spot-config.json'
} as const;

export const LOGGING_CONFIG = {
	directoryName: 'logs',
	fileName: 'spot-logs.ndjson',
	maximumFileSizeBytes: 1024 * 1024,
	retainedArchiveCount: 1
} as const;

export const TASKS_CONFIG = {
	flushDelayMs: 5000,
	stateChangeDelayMs: 3000,
	sortPositionStep: 1000
} as const;

export const AUDIT_CONFIG = {
	// Task updates are optimistic, so the task state can only be known to have reached the database by reading it back. This is a
	// first-period safety net meant to be switched off once the write path has been trusted for a while, not a part of that path.
	enabled: true,

	// The first audit lets the application settle instead of running right after the startup load, which nothing has written over yet
	initialDelayMs: 60000,
	intervalMs: 120000,

	// A report listing every task would be unreadable and would put the whole task list in the console, so the listed ones are capped
	maximumReportedTasks: 20
} as const;

export const SHUTDOWN_CONFIG = {
	// A write that failed can still be sitting on the retry delay when the flush handshake starts, and every retry that fails again schedules
	// the next one, so the wait has to cover the whole retry budget of one command and not just a single delay: the renderer cannot ask for
	// the retry sooner while it is waiting for the queue, so a shorter timeout gives up while the retry that saves the change has not run yet.
	// The queue gives a change up after that many attempts, so this is what a quit can be held for at worst, and only while writes keep failing.
	rendererFlushTimeoutMs: STORAGE_CONFIG.writeRetryDelayMs * STORAGE_CONFIG.maximumWriteAttempts + 3000,

	// The window stays interactive while the queued writes are drained, so the renderer flushes again to pick up what the user typed in the
	// meantime. The rounds are bounded, because someone who keeps typing must not be able to hold the quit open forever.
	maximumRendererFlushRounds: 3
} as const;
