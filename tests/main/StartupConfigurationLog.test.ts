import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { App } from 'electron';
import { initializeSpotTestLogger } from '../testUtils';
import { AUDIT_CONFIG, BACKUP_CONFIG, LOGGING_CONFIG } from 'src/config/AppConfig';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { resolveSpotRuntimePaths } from 'src/main/config/SpotRuntimePaths';
import { logStartupConfiguration, type LogStartupConfigurationOptions } from 'src/main/config/StartupConfigurationLog';

const userDataPath = path.join('/tmp', 'spot-user-data');

const createMockApp = (): Pick<App, 'getPath' | 'isPackaged'> => {
	return {
		getPath: vi.fn(() => {
			return userDataPath;
		}),
		isPackaged: true
	} as unknown as Pick<App, 'getPath' | 'isPackaged'>;
};

const readLogEntries = (logDirectory: string): Record<string, unknown>[] => {
	return readFileSync(path.join(logDirectory, LOGGING_CONFIG.fileName), 'utf8')
		.split('\n')
		.filter((line) => {
			return line.length > 0;
		})
		.map((line) => {
			return JSON.parse(line) as Record<string, unknown>;
		});
};

const createOptions = (overrides: Partial<LogStartupConfigurationOptions> = {}): LogStartupConfigurationOptions => {
	const runtimePaths = resolveSpotRuntimePaths(createMockApp());

	return {
		appVersion: '1.4.2',
		locale: 'it-IT',
		language: 'en',
		platform: 'darwin',
		architecture: 'arm64',
		versions: {
			electron: '38.0.0',
			chrome: '140.0.0',
			node: '22.0.0'
		},
		runtimePaths,
		backupLocation: {
			directory: '/Volumes/Backups/spot',
			defaultDirectory: runtimePaths.defaultBackupDirectory,
			databaseDirectory: runtimePaths.databaseDirectory,
			databasePath: runtimePaths.databasePath,
			isDevelopment: runtimePaths.isDevelopment,
			retainedBackupCount: 10
		},
		loadTarget: {
			type: 'file',
			value: path.join(userDataPath, 'build', 'index.html')
		},
		drawsMenuBar: false,
		...overrides
	};
};

describe('StartupConfigurationLog', () => {
	let logDirectory: string;

	beforeEach(() => {
		logDirectory = mkdtempSync(path.join(tmpdir(), 'spot-startup-log-'));
		initializeSpotTestLogger({ logDirectory });
	});

	afterEach(() => {
		resetAppLoggerForTests();
		rmSync(logDirectory, { recursive: true, force: true });
	});

	test('writes one entry describing the run', () => {
		const options = createOptions();

		logStartupConfiguration(options);

		const entries = readLogEntries(logDirectory);

		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			level: 'info',
			message: 'SPOT started',
			type: 'config.startup',
			version: '1.4.2',
			isDevelopment: false,
			platform: 'darwin',
			architecture: 'arm64',
			electronVersion: '38.0.0',
			chromeVersion: '140.0.0',
			nodeVersion: '22.0.0',
			locale: 'it-IT',
			language: 'en',
			drawsMenuBar: false
		});
	});

	// The folder the backups are written to is the whole reason this entry replaces the one every startup used to write
	test('names the folders this run reads and writes', () => {
		const options = createOptions();

		logStartupConfiguration(options);

		expect(readLogEntries(logDirectory)[0]).toMatchObject({
			paths: {
				root: options.runtimePaths.rootDirectory,
				config: options.runtimePaths.configFilePath,
				log: path.join(options.runtimePaths.logDirectory, LOGGING_CONFIG.fileName),
				database: options.runtimePaths.databasePath,
				defaultBackupDirectory: options.runtimePaths.defaultBackupDirectory,
				backupDirectory: '/Volumes/Backups/spot'
			}
		});
	});

	test('reports the settings that decide how the run behaves', () => {
		logStartupConfiguration(createOptions());

		expect(readLogEntries(logDirectory)[0]).toMatchObject({
			settings: {
				backupDelayAfterChangeMs: BACKUP_CONFIG.delayAfterChangeMs,
				backupArchiveIntervalMs: BACKUP_CONFIG.archiveIntervalMs,

				// The one backup setting the user chooses, so the entry reports what this run resolved rather than the default
				retainedBackupCount: 10,

				logMaximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
				logRetainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount,
				auditEnabled: AUDIT_CONFIG.enabled,
				auditIntervalMs: AUDIT_CONFIG.intervalMs
			}
		});
	});

	test('tells the built page apart from the development server', () => {
		logStartupConfiguration(createOptions({
			loadTarget: {
				type: 'url',
				value: 'http://localhost:5173'
			}
		}));

		expect(readLogEntries(logDirectory)[0]).toMatchObject({
			renderer: {
				source: 'development-server',
				location: 'http://localhost:5173'
			}
		});
	});
});
