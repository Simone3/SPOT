import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { EOL, tmpdir } from 'node:os';
import path from 'node:path';
import { createSpotLogger, initializeSpotLogger, resetSpotLoggerForTests, SPOT_LOG_FILE_NAME, SPOT_LOG_RETAINED_ARCHIVE_COUNT, SPOT_LOG_WRITE_FAILED_MESSAGE, SPOT_LOGGER_NOT_INITIALIZED_MESSAGE, spotLogger as processSpotLogger, type CreateSpotLoggerBackend, type SpotLogEntry } from 'src/main/logging/SpotLogger';

const makeTempStorageDirectory = (): string => {
	return mkdtempSync(path.join(tmpdir(), 'spot-logger-'));
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

const readSpotLogEntries = (storageDirectory: string): SpotLogEntry[] => {
	const content = readFileSync(path.join(storageDirectory, SPOT_LOG_FILE_NAME), 'utf8').trim();

	if(!content) {
		return [];
	}

	return content.split(/\r?\n/).map((line) => {
		return JSON.parse(line) as SpotLogEntry;
	});
};

const createFakeBackendFactory = (write: (message: string) => void): CreateSpotLoggerBackend => {
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

describe('SpotLogger', () => {
	const tempStorageDirectories: string[] = [];

	afterEach(async() => {
		await processSpotLogger.flush();
		resetSpotLoggerForTests();

		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('keeps the process-wide logger safe before initialization', async() => {
		expect(processSpotLogger.getStatus()).toEqual({
			state: 'unavailable',
			message: SPOT_LOGGER_NOT_INITIALIZED_MESSAGE
		});
		expect(() => {
			processSpotLogger.info('Ignored before startup initialization');
		}).not.toThrow();
		await expect(processSpotLogger.flush()).resolves.toBeUndefined();
		expect(() => {
			processSpotLogger.getConfiguration();
		}).toThrow(SPOT_LOGGER_NOT_INITIALIZED_MESSAGE);
	});

	test('exposes initialized logging through a stable process-wide utility', () => {
		const processLogger = processSpotLogger;
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');

		initializeSpotLogger({
			storageDirectory,
			retryDelayMs: 0,
			now: () => {
				return createdAt;
			}
		});

		expect(processSpotLogger).toBe(processLogger);
		processSpotLogger.info('Process logger initialized', {
			type: 'main.startup'
		});

		expect(readSpotLogEntries(storageDirectory)).toEqual([
			{
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Process logger initialized',
				type: 'main.startup'
			}
		]);
	});

	test('writes structured newline-delimited JSON entries for public log levels', () => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const spotLogger = createSpotLogger({
			storageDirectory,
			retryDelayMs: 0,
			now: () => {
				return createdAt;
			}
		});

		spotLogger.info('React storage command received', {
			type: 'react.command',
			command: 'task.create'
		});
		spotLogger.warn('Storage warning', {
			type: 'storage.warning'
		});
		spotLogger.error('Storage SQL query failed', {
			type: 'sql.query',
			elapsedMillis: 2.5
		});
		spotLogger.debug('Storage debug detail', {
			type: 'storage.debug'
		});

		expect(readSpotLogEntries(storageDirectory)).toEqual([
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
				elapsedMillis: 2.5
			},
			{
				createdAt: createdAt.toISOString(),
				level: 'debug',
				message: 'Storage debug detail',
				type: 'storage.debug'
			}
		]);
		expect(spotLogger.getStatus()).toEqual({
			state: 'healthy'
		});
	});

	test('creates the log directory before checking startup writability', () => {
		const parentDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(parentDirectory);
		const storageDirectory = path.join(parentDirectory, 'storage');
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const spotLogger = createSpotLogger({
			storageDirectory,
			retryDelayMs: 0,
			now: () => {
				return createdAt;
			}
		});

		spotLogger.info('Logger directory created', {
			type: 'main.startup'
		});

		expect(spotLogger.getStatus()).toEqual({
			state: 'healthy'
		});
		expect(readSpotLogEntries(storageDirectory)).toEqual([
			{
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Logger directory created',
				type: 'main.startup'
			}
		]);
	});

	test('reports unavailable startup logging when the log file cannot be opened', () => {
		const parentDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(parentDirectory);
		const storageDirectory = path.join(parentDirectory, 'not-a-directory');
		writeFileSync(storageDirectory, 'file', 'utf8');

		const spotLogger = createSpotLogger({
			storageDirectory,
			maximumWriteAttempts: 1,
			backendFactory: createFakeBackendFactory(() => {
				return undefined;
			}),
			retryDelayMs: 0
		});

		expect(spotLogger.getStatus()).toEqual({
			state: 'unavailable',
			message: expect.stringContaining('Could not open')
		});
		expect(spotLogger.getStatus()).toEqual({
			state: 'unavailable',
			message: expect.stringContaining(SPOT_LOG_WRITE_FAILED_MESSAGE)
		});
		expect(() => {
			spotLogger.info('Startup logging is unavailable');
		}).not.toThrow();
	});

	test('configures size-based rolling with bounded retention', () => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const spotLogger = createSpotLogger({
			storageDirectory,
			maximumFileSizeBytes: 180,
			retryDelayMs: 0
		});

		for(let index = 0; index < 8; index += 1) {
			spotLogger.info('Storage SQL query completed', {
				type: 'sql.query',
				query: `SELECT '${'x'.repeat(80)}-${index}'`
			});
		}

		const configuration = spotLogger.getConfiguration();
		const logFiles = readdirSync(storageDirectory).filter((fileName) => {
			return fileName.startsWith('spot-logs');
		});

		expect(configuration.maximumFileSizeBytes).toBe(180);
		expect(configuration.retainedArchiveCount).toBe(SPOT_LOG_RETAINED_ARCHIVE_COUNT);
		expect(logFiles).toContain(SPOT_LOG_FILE_NAME);
		expect(logFiles).toContain('spot-logs.old.ndjson');
		expect(logFiles.length).toBeLessThanOrEqual(SPOT_LOG_RETAINED_ARCHIVE_COUNT + 1);
	});

	test('retries a failed write until a later attempt reaches the file', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const spotLogPath = path.join(storageDirectory, SPOT_LOG_FILE_NAME);
		let attempts = 0;
		const backendFactory = createFakeBackendFactory((message) => {
			attempts += 1;

			if(attempts > 1) {
				appendFileSync(spotLogPath, `${message}${EOL}`, 'utf8');
			}
		});
		const spotLogger = createSpotLogger({
			storageDirectory,
			maximumWriteAttempts: 3,
			retryDelayMs: 0,
			backendFactory
		});

		spotLogger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT retry_success'
		});

		await waitForExpectation(() => {
			expect(attempts).toBe(2);
			expect(readSpotLogEntries(storageDirectory)).toEqual([
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
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const spotLogPath = path.join(storageDirectory, SPOT_LOG_FILE_NAME);
		let attempts = 0;
		const backendFactory = createFakeBackendFactory((message) => {
			attempts += 1;

			if(attempts > 1) {
				appendFileSync(spotLogPath, `${message}${EOL}`, 'utf8');
			}
		});
		const spotLogger = createSpotLogger({
			storageDirectory,
			maximumWriteAttempts: 3,
			retryDelayMs: 0,
			backendFactory
		});

		spotLogger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT flush_retry_success'
		});

		await spotLogger.flush();

		expect(attempts).toBe(2);
		expect(readSpotLogEntries(storageDirectory)).toEqual([
			expect.objectContaining({
				level: 'info',
				message: 'Storage SQL query completed',
				type: 'sql.query',
				query: 'SELECT flush_retry_success'
			})
		]);
	});

	test('ignores failed writes without changing startup logging status', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		let attempts = 0;
		const backendFactory = createFakeBackendFactory(() => {
			attempts += 1;
		});
		const spotLogger = createSpotLogger({
			storageDirectory,
			maximumWriteAttempts: 2,
			retryDelayMs: 0,
			backendFactory
		});

		expect(() => {
			spotLogger.info('Storage SQL query completed', {
				type: 'sql.query',
				query: 'SELECT retry_failure'
			});
		}).not.toThrow();

		await waitForExpectation(() => {
			expect(attempts).toBe(2);
		});

		expect(spotLogger.getStatus()).toEqual({
			state: 'healthy'
		});
	});

	test('flush abandons failed writes after the bounded retry attempts', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		let attempts = 0;
		const backendFactory = createFakeBackendFactory(() => {
			attempts += 1;
		});
		const spotLogger = createSpotLogger({
			storageDirectory,
			maximumWriteAttempts: 2,
			retryDelayMs: 0,
			backendFactory
		});

		spotLogger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT flush_retry_failure'
		});

		await spotLogger.flush();

		expect(attempts).toBe(2);
		expect(spotLogger.getStatus()).toEqual({
			state: 'healthy'
		});
	});
});
