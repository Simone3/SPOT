import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initializeSpotTestLogger } from '../testUtils';
import { LOGGING_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { appLogger as processAppLogger, resetAppLoggerForTests, type AppLogEntry } from 'src/framework/main/logging/AppLogger';
import { openSpotDatabase } from 'src/main/storage/SpotDatabase';

interface TableColumnRow {
	name: string;
	type: string;
	notnull: number;
	pk: number;
}

interface MigrationRow {
	version: number;
	applied_at: string;
}

const makeTempStorageDirectory = (): string => {
	return mkdtempSync(path.join(tmpdir(), 'spot-storage-'));
};

const readSpotLogEntries = (storageDirectory: string): AppLogEntry[] => {
	const content = readFileSync(path.join(storageDirectory, LOGGING_CONFIG.fileName), 'utf8').trim();

	if(!content) {
		return [];
	}

	return content.split(/\r?\n/).map((line) => {
		return JSON.parse(line) as AppLogEntry;
	});
};

describe('SpotDatabase', () => {
	const tempStorageDirectories: string[] = [];

	afterEach(async() => {
		await processAppLogger.flush();
		resetAppLoggerForTests();

		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('opens a spot SQLite database and applies the version 1 schema', () => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const appliedAt = new Date('2026-06-06T12:00:00.000Z');

		const spotDatabase = openSpotDatabase({
			storageDirectory,
			now: () => {
				return appliedAt;
			}
		});

		try {
			expect(spotDatabase.databasePath).toBe(path.join(storageDirectory, STORAGE_CONFIG.databaseFileName));
			expect(existsSync(spotDatabase.databasePath)).toBe(true);
			expect(spotDatabase.getAppliedMigrationVersions()).toEqual([ STORAGE_CONFIG.currentSchemaVersion ]);

			const taskColumns = spotDatabase.getAllQueryRows<TableColumnRow>('PRAGMA table_info(tasks)');
			expect(taskColumns.map((column) => {
				return {
					name: column.name,
					type: column.type,
					notnull: column.notnull,
					pk: column.pk
				};
			})).toEqual([
				{ name: 'id', type: 'TEXT', notnull: 0, pk: 1 },
				{ name: 'text', type: 'TEXT', notnull: 1, pk: 0 },
				{ name: 'state', type: 'TEXT', notnull: 1, pk: 0 },
				{ name: 'priority', type: 'TEXT', notnull: 1, pk: 0 },
				{ name: 'owner', type: 'TEXT', notnull: 0, pk: 0 },
				{ name: 'due_date', type: 'TEXT', notnull: 0, pk: 0 },
				{ name: 'tags_json', type: 'TEXT', notnull: 1, pk: 0 },
				{ name: 'sort_position', type: 'INTEGER', notnull: 1, pk: 0 },
				{ name: 'completion_date', type: 'TEXT', notnull: 0, pk: 0 },
				{ name: 'created_at', type: 'TEXT', notnull: 1, pk: 0 },
				{ name: 'updated_at', type: 'TEXT', notnull: 1, pk: 0 }
			]);

			const migration = spotDatabase.getQuery<MigrationRow>(`
				SELECT version, applied_at
				FROM schema_migrations
			`);
			expect(migration).toEqual({
				version: STORAGE_CONFIG.currentSchemaVersion,
				applied_at: appliedAt.toISOString()
			});
		}
		finally {
			spotDatabase.close();
		}
	});

	test('does not reapply an already recorded migration', () => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const firstAppliedAt = new Date('2026-06-06T12:00:00.000Z');
		const secondAppliedAt = new Date('2026-06-07T12:00:00.000Z');
		const firstSpotDatabase = openSpotDatabase({
			storageDirectory,
			now: () => {
				return firstAppliedAt;
			}
		});
		firstSpotDatabase.close();

		const secondSpotDatabase = openSpotDatabase({
			storageDirectory,
			now: () => {
				return secondAppliedAt;
			}
		});

		try {
			const migrations = secondSpotDatabase.getAllQueryRows<MigrationRow>(`
				SELECT version, applied_at
				FROM schema_migrations
			`);
			expect(migrations).toEqual([
				{
					version: STORAGE_CONFIG.currentSchemaVersion,
					applied_at: firstAppliedAt.toISOString()
				}
			]);
		}
		finally {
			secondSpotDatabase.close();
		}
	});

	test('rethrows the original transaction error even when the rollback fails', () => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const spotDatabase = openSpotDatabase({ storageDirectory });

		try {
			expect(() => {
				spotDatabase.runTransaction(() => {
					// Ends the transaction behind the wrapper, so the rollback in the error path fails on its own
					spotDatabase.execQuery('COMMIT');
					throw new Error('Transaction callback failed.');
				});
			}).toThrow('Transaction callback failed.');
		}
		finally {
			spotDatabase.close();
		}
	});

	test('logs SQL queries through the process-wide logger', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const appliedAt = new Date('2026-06-06T12:00:00.000Z');
		initializeSpotTestLogger({
			logDirectory: storageDirectory,
			now: () => {
				return appliedAt;
			}
		});
		const spotDatabase = openSpotDatabase({
			storageDirectory,
			now: () => {
				return appliedAt;
			}
		});

		try {
			spotDatabase.getAllQueryRows<MigrationRow>(`
				SELECT version
				FROM schema_migrations
				ORDER BY version ASC
			`);
		}
		finally {
			spotDatabase.close();
		}
		await processAppLogger.flush();

		expect(readSpotLogEntries(storageDirectory)).toEqual(expect.arrayContaining([
			expect.objectContaining({
				createdAt: appliedAt.toISOString(),
				level: 'info',
				message: 'Storage SQL query completed',
				type: 'sql.query',
				query: 'SELECT version FROM schema_migrations ORDER BY version ASC',
				elapsedMillis: expect.any(Number),
				result: 'success'
			})
		]));
	});
});
