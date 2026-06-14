import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { EOL, tmpdir } from 'node:os';
import path from 'node:path';
import { createOperationalLog, OPERATIONAL_LOG_FILE_NAME, OPERATIONAL_LOG_RETAINED_ARCHIVE_COUNT, OPERATIONAL_LOG_WRITE_FAILED_MESSAGE, type CreateOperationalLogLogger } from 'src/main/storage/OperationalLog';
import type { OperationalLogEntry } from 'src/main/storage/TaskStorage';

const makeTempStorageDirectory = (): string => {
	return mkdtempSync(path.join(tmpdir(), 'spot-operational-log-'));
};

const readOperationalLogEntries = (storageDirectory: string): OperationalLogEntry[] => {
	const content = readFileSync(path.join(storageDirectory, OPERATIONAL_LOG_FILE_NAME), 'utf8').trim();

	if(!content) {
		return [];
	}

	return content.split(/\r?\n/).map((line) => {
		return JSON.parse(line) as OperationalLogEntry;
	});
};

const createSqlLogEntry = (query: string): OperationalLogEntry => {
	return {
		createdAt: '2026-06-06T12:00:00.000Z',
		type: 'sql.query',
		query,
		durationMs: 1.5,
		result: 'success'
	};
};

const createFakeLoggerFactory = (write: (message: string) => void): CreateOperationalLogLogger => {
	return () => {
		return {
			info: write,
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

describe('OperationalLog', () => {
	const tempStorageDirectories: string[] = [];

	afterEach(() => {
		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('writes newline-delimited JSON entries with the configured file transport', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const operationalLog = createOperationalLog({
			storageDirectory,
			retryDelayMs: 0
		});
		const entry = createSqlLogEntry('SELECT 1');

		const result = await operationalLog.writeEntry(entry);

		expect(result).toEqual({
			ok: true,
			status: {
				state: 'healthy'
			}
		});
		expect(readOperationalLogEntries(storageDirectory)).toEqual([ entry ]);
		expect(operationalLog.getStatus()).toEqual({
			state: 'healthy'
		});
	});

	test('configures size-based rolling with bounded retention', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const operationalLog = createOperationalLog({
			storageDirectory,
			maximumFileSizeBytes: 180,
			retryDelayMs: 0
		});

		for(let index = 0; index < 8; index += 1) {
			await operationalLog.writeEntry(createSqlLogEntry(`SELECT '${'x'.repeat(80)}-${index}'`));
		}

		const configuration = operationalLog.getConfiguration();
		const logFiles = readdirSync(storageDirectory).filter((fileName) => {
			return fileName.startsWith('spot-logs');
		});

		expect(configuration.maximumFileSizeBytes).toBe(180);
		expect(configuration.retainedArchiveCount).toBe(OPERATIONAL_LOG_RETAINED_ARCHIVE_COUNT);
		expect(logFiles).toContain(OPERATIONAL_LOG_FILE_NAME);
		expect(logFiles).toContain('spot-logs.old.ndjson');
		expect(logFiles.length).toBeLessThanOrEqual(OPERATIONAL_LOG_RETAINED_ARCHIVE_COUNT + 1);
	});

	test('retries a failed write and reports success when a later attempt reaches the file', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const operationalLogPath = path.join(storageDirectory, OPERATIONAL_LOG_FILE_NAME);
		let attempts = 0;
		const loggerFactory = createFakeLoggerFactory((message) => {
			attempts += 1;

			if(attempts > 1) {
				appendFileSync(operationalLogPath, `${message}${EOL}`, 'utf8');
			}
		});
		const operationalLog = createOperationalLog({
			storageDirectory,
			maximumWriteAttempts: 3,
			retryDelayMs: 0,
			loggerFactory
		});
		const entry = createSqlLogEntry('SELECT retry_success');

		const result = await operationalLog.writeEntry(entry);

		expect(attempts).toBe(2);
		expect(result).toEqual({
			ok: true,
			status: {
				state: 'healthy'
			}
		});
		expect(readOperationalLogEntries(storageDirectory)).toEqual([ entry ]);
	});

	test('reports an unavailable operational log after bounded retry failures', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		let attempts = 0;
		const loggerFactory = createFakeLoggerFactory(() => {
			attempts += 1;
		});
		const operationalLog = createOperationalLog({
			storageDirectory,
			maximumWriteAttempts: 2,
			retryDelayMs: 0,
			loggerFactory
		});

		const result = await operationalLog.writeEntry(createSqlLogEntry('SELECT retry_failure'));

		expect(attempts).toBe(2);
		expect(result).toMatchObject({
			ok: false,
			message: expect.stringContaining(OPERATIONAL_LOG_WRITE_FAILED_MESSAGE),
			status: {
				state: 'unavailable',
				message: expect.stringContaining('Failed after 2 write attempts')
			}
		});
		expect(operationalLog.getStatus()).toEqual(result.status);
	});
});
