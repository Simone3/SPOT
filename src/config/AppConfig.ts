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
	writeRetryDelayMs: 5000
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
	retainedArchiveCount: 1,
	maximumWriteAttempts: 3,
	retryDelayMs: 25
} as const;

export const TASKS_CONFIG = {
	flushDelayMs: 5000,
	stateChangeDelayMs: 3000,
	sortPositionStep: 1000
} as const;

export const SHUTDOWN_CONFIG = {
	// A write that failed can still be sitting on the retry delay when the flush handshake starts, so the wait has to outlast that delay: a
	// shorter timeout would give up while the retry that saves the change has not even run yet
	rendererFlushTimeoutMs: STORAGE_CONFIG.writeRetryDelayMs + 3000
} as const;
