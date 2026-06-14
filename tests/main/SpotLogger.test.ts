import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { EOL, tmpdir } from 'node:os';
import path from 'node:path';
import { createSpotLogger, SPOT_LOG_FILE_NAME, SPOT_LOG_RETAINED_ARCHIVE_COUNT, SPOT_LOG_WRITE_FAILED_MESSAGE, type CreateSpotLoggerBackend, type SpotLogEntry } from 'src/main/logging/SpotLogger';

const makeTempStorageDirectory = (): string => {
	return mkdtempSync(path.join(tmpdir(), 'spot-logger-'));
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

	afterEach(() => {
		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('writes structured newline-delimited JSON entries for public log levels', async() => {
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

		await expect(spotLogger.info('React storage command received', {
			type: 'react.command',
			command: 'task.create'
		})).resolves.toEqual({
			ok: true,
			status: {
				state: 'healthy'
			}
		});
		await spotLogger.warn('Storage warning', {
			type: 'storage.warning'
		});
		await spotLogger.error('Storage SQL query failed', {
			type: 'sql.query',
			elapsedMillis: 2.5
		});
		await spotLogger.debug('Storage debug detail', {
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

	test('configures size-based rolling with bounded retention', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const spotLogger = createSpotLogger({
			storageDirectory,
			maximumFileSizeBytes: 180,
			retryDelayMs: 0
		});

		for(let index = 0; index < 8; index += 1) {
			await spotLogger.info('Storage SQL query completed', {
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

	test('retries a failed write and reports success when a later attempt reaches the file', async() => {
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

		const result = await spotLogger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT retry_success'
		});

		expect(attempts).toBe(2);
		expect(result).toEqual({
			ok: true,
			status: {
				state: 'healthy'
			}
		});
		expect(readSpotLogEntries(storageDirectory)).toEqual([
			expect.objectContaining({
				level: 'info',
				message: 'Storage SQL query completed',
				type: 'sql.query',
				query: 'SELECT retry_success'
			})
		]);
	});

	test('reports an unavailable logger after bounded retry failures', async() => {
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

		const result = await spotLogger.info('Storage SQL query completed', {
			type: 'sql.query',
			query: 'SELECT retry_failure'
		});

		expect(attempts).toBe(2);
		expect(result).toMatchObject({
			ok: false,
			message: expect.stringContaining(SPOT_LOG_WRITE_FAILED_MESSAGE),
			status: {
				state: 'unavailable',
				message: expect.stringContaining('Failed after 2 write attempts')
			}
		});
		expect(spotLogger.getStatus()).toEqual(result.status);
	});
});
