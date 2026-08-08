import path from 'node:path';
import { AUDIT_CONFIG, BACKUP_CONFIG, LOGGING_CONFIG, STORAGE_CONFIG, TASKS_CONFIG } from 'src/config/AppConfig';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import type { WindowLoadTarget } from 'src/framework/main/window/WindowLoadTarget';
import type { BackupLocation } from 'src/framework/types/BackupTypes';
import type { SpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';

// What the runtime reports about itself. Every field is optional because these come straight from "process.versions", which
// promises nothing about which of them a given runtime fills in.
export interface StartupRuntimeVersions {
	electron?: string;
	chrome?: string;
	node?: string;
}

export interface LogStartupConfigurationOptions {
	appVersion: string;

	// What the operating system asked for, and what SPOT resolved it to. They differ whenever no bundle matches the operating system.
	locale: string;
	language: string;

	platform: string;
	architecture: string;
	versions: StartupRuntimeVersions;
	runtimePaths: SpotRuntimePaths;

	// The folder this run will actually back up to, which is only known once the location manager resolved it
	backupLocation: BackupLocation;

	loadTarget: WindowLoadTarget;
	drawsMenuBar: boolean;
}

// Writes the one entry describing the run the rest of the log belongs to. A log file otherwise only says what happened, never what it
// happened in: the version, the folders, and the settings behind a backup that was late or a write that was refused are in no other
// entry, and a file collected from an installed SPOT cannot be asked about them afterwards. This is therefore written once per run
// and holds everything a report about that run needs.
export const logStartupConfiguration = ({
	appVersion,
	locale,
	language,
	platform,
	architecture,
	versions,
	runtimePaths,
	backupLocation,
	loadTarget,
	drawsMenuBar
}: LogStartupConfigurationOptions): void => {
	appLogger.info('SPOT started', {
		type: 'config.startup',
		version: appVersion,
		isDevelopment: runtimePaths.isDevelopment,
		platform,
		architecture,
		electronVersion: versions.electron,
		chromeVersion: versions.chrome,
		nodeVersion: versions.node,
		locale,
		language,

		// The renderer of a development run comes from the development server, and every other run loads the built page from disk
		renderer: {
			source: loadTarget.type === 'url' ? 'development-server' : 'build',
			location: loadTarget.value
		},

		drawsMenuBar,
		paths: {
			root: runtimePaths.rootDirectory,
			config: runtimePaths.configFilePath,
			log: path.join(runtimePaths.logDirectory, LOGGING_CONFIG.fileName),
			database: runtimePaths.databasePath,
			defaultBackupDirectory: backupLocation.defaultDirectory,
			backupDirectory: backupLocation.directory
		},

		// The settings that decide how a run behaves, rather than every value in "AppConfig": what a log is read for is a write that
		// was retried, a backup that was made or skipped, an audit that reported a drift, and how large the file itself may grow
		settings: {
			databaseTimeoutMs: STORAGE_CONFIG.databaseTimeoutMs,
			writeRetryDelayMs: STORAGE_CONFIG.writeRetryDelayMs,
			maximumWriteAttempts: STORAGE_CONFIG.maximumWriteAttempts,
			taskFlushDelayMs: TASKS_CONFIG.flushDelayMs,
			backupDelayAfterChangeMs: BACKUP_CONFIG.delayAfterChangeMs,
			retainedBackupCount: BACKUP_CONFIG.retainedBackupCount,
			backupShutdownTimeoutMs: BACKUP_CONFIG.shutdownTimeoutMs,
			logMaximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
			logRetainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount,
			auditEnabled: AUDIT_CONFIG.enabled,
			auditInitialDelayMs: AUDIT_CONFIG.initialDelayMs,
			auditIntervalMs: AUDIT_CONFIG.intervalMs
		}
	});
};
