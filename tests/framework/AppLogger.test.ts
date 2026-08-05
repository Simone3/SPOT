import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { EOL, tmpdir } from 'node:os';
import path from 'node:path';
import { appLogger as processAppLogger, createAppLogger, initializeAppLogger, LOG_WRITE_FAILED_MESSAGE, LOGGER_NOT_INITIALIZED_MESSAGE, resetAppLoggerForTests, type AppLogEntry, type CreateAppLoggerBackend, type CreateAppLoggerOptions } from 'src/framework/main/logging/AppLogger';

const TEST_LOG_FILE_NAME = 'app-logs.ndjson';

const TEST_RETAINED_ARCHIVE_COUNT = 1;

// The framework logger takes every setting from its caller, so the tests supply one baseline and override only what they exercise
const createTestLoggerOptions = (options: Partial<CreateAppLoggerOptions> & Pick<CreateAppLoggerOptions, 'logDirectory'>): CreateAppLoggerOptions => {
	return {
		fileName: TEST_LOG_FILE_NAME,
		maximumFileSizeBytes: 1024 * 1024,
		retainedArchiveCount: TEST_RETAINED_ARCHIVE_COUNT,
		maximumWriteAttempts: 3,
		retryDelayMs: 25,
		...options
	};
};

const createTestLogger = (options: Partial<CreateAppLoggerOptions> & Pick<CreateAppLoggerOptions, 'logDirectory'>) => {
	return createAppLogger(createTestLoggerOptions(options));
};

const makeTempLogDirectory = (): string => {
	return mkdtempSync(path.join(tmpdir(), 'app-logger-'));
};

const sleep = (durationMs: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});
};

const waitForExpectation = async(expectation: () => void): Promise<void> => {
	let lastError: unknown;

	for(let attempt = 1; attempt <= 20; attempt += 1) {
		try {
			expectation();
			return;
		}
		catch(error) {
			lastError = error;
			await sleep(5);
		}
	}

	if(lastError instanceof Error) {
		throw lastError;
	}

	throw new Error(String(lastError));
};

const readAppLogEntries = (logDirectory: string): AppLogEntry[] => {
	const content = readFileSync(path.join(logDirectory, TEST_LOG_FILE_NAME), 'utf8').trim();

	if(!content) {
		return [];
	}

	return content.split(/\r?\n/).map((line) => {
		return JSON.parse(line) as AppLogEntry;
	});
};

const createFakeBackendFactory = (write: (message: string) => void): CreateAppLoggerBackend => {
	return () => {
		return {
			debug: write,
			error: write,
			info: write,
			warn: write,
			transports: {
				console: {
					level: 'info'
				},
				file: {
					level: 'info',
					fileName: '',
					format: ({ data }) => {
						return data;
					},
					maxSize: 0,
					resolvePathFn: () => {
						return '';
					},
					sync: false
				},
				ipc: {
					level: 'info'
				},
				remote: {
					level: 'info'
				}
			}
		};
	};
};

describe('AppLogger', () => {
	const tempStorageDirectories: string[] = [];

	afterEach(async() => {
		await processAppLogger.flush();
		resetAppLoggerForTests();

		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('keeps the process-wide logger safe before initialization', async() => {
		expect(processAppLogger.getStatus()).toEqual({
			state: 'unavailable',
			message: LOGGER_NOT_INITIALIZED_MESSAGE
		});
		expect(() => {
			processAppLogger.info('Ignored before startup initialization');
		}).not.toThrow();
		await expect(processAppLogger.flush()).resolves.toBeUndefined();
		expect(() => {
			processAppLogger.getConfiguration();
		}).toThrow(LOGGER_NOT_INITIALIZED_MESSAGE);
	});

	test('exposes initialized logging through a stable process-wide utility', () => {
		const processLogger = processAppLogger;
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');

		initializeAppLogger(createTestLoggerOptions({
			logDirectory,
			retryDelayMs: 0,
			now: () => {
				return createdAt;
			}
		}));

		expect(processAppLogger).toBe(processLogger);
		processAppLogger.info('Process logger initialized', {
			type: 'main.startup'
		});

		expect(readAppLogEntries(logDirectory)).toEqual([
			{
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Process logger initialized',
				type: 'main.startup'
			}
		]);
	});

	test('writes structured newline-delimited JSON entries for public log levels', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const logger = createTestLogger({
			logDirectory,
			retryDelayMs: 0,
			now: () => {
				return createdAt;
			}
		});

		logger.info('React storage command received', {
			type: 'react.command',
			command: 'task.create'
		});
		logger.warn('Storage warning', {
			type: 'storage.warning'
		});
		logger.error('Storage SQL query failed', {
			type: 'sql.query',
			elapsedMillis: 3
		});
		logger.debug('Storage debug detail', {
			type: 'storage.debug'
		});

		expect(readAppLogEntries(logDirectory)).toEqual([
			{
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'React storage command received',
				type: 'react.command',
				command: 'task.create'
			},
			{
				createdAt: createdAt.toISOString(),
				level: 'warn',
				message: 'Storage warning',
				type: 'storage.warning'
			},
			{
				createdAt: createdAt.toISOString(),
				level: 'error',
				message: 'Storage SQL query failed',
				type: 'sql.query',
				elapsedMillis: 3
			},
			{
				createdAt: createdAt.toISOString(),
				level: 'debug',
				message: 'Storage debug detail',
				type: 'storage.debug'
			}
		]);
		expect(logger.getStatus()).toEqual({
			state: 'healthy'
		});
	});

	test('creates the log directory before checking startup writability', () => {
		const parentDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(parentDirectory);
		const logDirectory = path.join(parentDirectory, 'storage');
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const logger = createTestLogger({
			logDirectory,
			retryDelayMs: 0,
			now: () => {
				return createdAt;
			}
		});

		logger.info('Logger directory created', {
			type: 'main.startup'
		});

		expect(logger.getStatus()).toEqual({
			state: 'healthy'
		});
		expect(readAppLogEntries(logDirectory)).toEqual([
			{
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Logger directory created',
				type: 'main.startup'
			}
		]);
	});

	test('reports unavailable startup logging when the log file cannot be opened', () => {
		const parentDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(parentDirectory);
		const logDirectory = path.join(parentDirectory, 'not-a-directory');
		writeFileSync(logDirectory, 'file', 'utf8');

		const logger = createTestLogger({
			logDirectory,
			maximumWriteAttempts: 1,
			backendFactory: createFakeBackendFactory(() => {
				return undefined;
			}),
			retryDelayMs: 0
		});

		expect(logger.getStatus()).toEqual({
			state: 'unavailable',
			message: expect.stringContaining('Could not open')
		});
		expect(logger.getStatus()).toEqual({
			state: 'unavailable',
			message: expect.stringContaining(LOG_WRITE_FAILED_MESSAGE)
		});
		expect(() => {
			logger.info('Startup logging is unavailable');
		}).not.toThrow();
	});

	test('configures size-based rolling with bounded retention', () => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const logger = createTestLogger({
			logDirectory,
			maximumFileSizeBytes: 180,
			retryDelayMs: 0
		});

		for(let index = 0; index < 8; index += 1) {
			logger.info('Storage SQL query completed', {
				type: 'sql.query',
				query: `SELECT '${'x'.repeat(80)}-${index}'`
			});
		}

		const configuration = logger.getConfiguration();
		const logFiles = readdirSync(logDirectory).filter((fileName) => {
			return fileName.startsWith('app-logs');
		});

		expect(configuration.maximumFileSizeBytes).toBe(180);
		expect(configuration.retainedArchiveCount).toBe(TEST_RETAINED_ARCHIVE_COUNT);
		expect(logFiles).toContain(TEST_LOG_FILE_NAME);
		expect(logFiles).toContain('app-logs.old.ndjson');
		expect(logFiles.length).toBeLessThanOrEqual(TEST_RETAINED_ARCHIVE_COUNT + 1);
	});

	test('retries a failed write until a later attempt reaches the file', async() => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const appLogPath = path.join(logDirectory, TEST_LOG_FILE_NAME);
		let attempts = 0;
		const backendFactory = createFakeBackendFactory((message) => {
			attempts += 1;

			if(attempts > 1) {
				appendFileSync(appLogPath, `${message}${EOL}`, 'utf8');
			}
		});
		const logger = createTestLogger({
			logDirectory,
			maximumWriteAttempts: 3,
			retryDelayMs: 0,
			backendFactory
		});

		logger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT retry_success'
		});

		await waitForExpectation(() => {
			expect(attempts).toBe(2);
			expect(readAppLogEntries(logDirectory)).toEqual([
				expect.objectContaining({
					level: 'info',
					message: 'Storage SQL query completed',
					type: 'sql.query',
					query: 'SELECT retry_success'
				})
			]);
		});
	});

	test('flushes pending retry writes before resolving', async() => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		const appLogPath = path.join(logDirectory, TEST_LOG_FILE_NAME);
		let attempts = 0;
		const backendFactory = createFakeBackendFactory((message) => {
			attempts += 1;

			if(attempts > 1) {
				appendFileSync(appLogPath, `${message}${EOL}`, 'utf8');
			}
		});
		const logger = createTestLogger({
			logDirectory,
			maximumWriteAttempts: 3,
			retryDelayMs: 0,
			backendFactory
		});

		logger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT flush_retry_success'
		});

		await logger.flush();

		expect(attempts).toBe(2);
		expect(readAppLogEntries(logDirectory)).toEqual([
			expect.objectContaining({
				level: 'info',
				message: 'Storage SQL query completed',
				type: 'sql.query',
				query: 'SELECT flush_retry_success'
			})
		]);
	});

	test('ignores failed writes without changing startup logging status', async() => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		let attempts = 0;
		const backendFactory = createFakeBackendFactory(() => {
			attempts += 1;
		});
		const logger = createTestLogger({
			logDirectory,
			maximumWriteAttempts: 2,
			retryDelayMs: 0,
			backendFactory
		});

		expect(() => {
			logger.info('Storage SQL query completed', {
				type: 'sql.query',
				query: 'SELECT retry_failure'
			});
		}).not.toThrow();

		await waitForExpectation(() => {
			expect(attempts).toBe(2);
		});

		expect(logger.getStatus()).toEqual({
			state: 'healthy'
		});
	});

	test('flush abandons failed writes after the bounded retry attempts', async() => {
		const logDirectory = makeTempLogDirectory();
		tempStorageDirectories.push(logDirectory);
		let attempts = 0;
		const backendFactory = createFakeBackendFactory(() => {
			attempts += 1;
		});
		const logger = createTestLogger({
			logDirectory,
			maximumWriteAttempts: 2,
			retryDelayMs: 0,
			backendFactory
		});

		logger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT flush_retry_failure'
		});

		await logger.flush();

		expect(attempts).toBe(2);
		expect(logger.getStatus()).toEqual({
			state: 'healthy'
		});
	});
});
