import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CURRENT_SCHEMA_VERSION, DATABASE_FILE_NAME, openTaskDatabase } from 'src/main/storage/TaskDatabase';

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

describe('TaskDatabase', () => {
	const tempStorageDirectories: string[] = [];

	afterEach(() => {
		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('opens a spot SQLite database and applies the version 1 schema', () => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const appliedAt = new Date('2026-06-06T12:00:00.000Z');

		const taskDatabase = openTaskDatabase({
			storageDirectory,
			now: () => {
				return appliedAt;
			}
		});

		try {
			expect(taskDatabase.databasePath).toBe(path.join(storageDirectory, DATABASE_FILE_NAME));
			expect(existsSync(taskDatabase.databasePath)).toBe(true);
			expect(taskDatabase.getAppliedMigrationVersions()).toEqual([ CURRENT_SCHEMA_VERSION ]);

			const taskColumns = taskDatabase.connection.prepare('PRAGMA table_info(tasks)').all() as unknown as TableColumnRow[];
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

			const migration = taskDatabase.connection.prepare(`
				SELECT version, applied_at
				FROM schema_migrations
			`).get() as unknown as MigrationRow;
			expect(migration).toEqual({
				version: CURRENT_SCHEMA_VERSION,
				applied_at: appliedAt.toISOString()
			});
		}
		finally {
			taskDatabase.close();
		}
	});

	test('does not reapply an already recorded migration', () => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const firstAppliedAt = new Date('2026-06-06T12:00:00.000Z');
		const secondAppliedAt = new Date('2026-06-07T12:00:00.000Z');
		const firstTaskDatabase = openTaskDatabase({
			storageDirectory,
			now: () => {
				return firstAppliedAt;
			}
		});
		firstTaskDatabase.close();

		const secondTaskDatabase = openTaskDatabase({
			storageDirectory,
			now: () => {
				return secondAppliedAt;
			}
		});

		try {
			const migrations = secondTaskDatabase.connection.prepare(`
				SELECT version, applied_at
				FROM schema_migrations
			`).all() as unknown as MigrationRow[];
			expect(migrations).toEqual([
				{
					version: CURRENT_SCHEMA_VERSION,
					applied_at: firstAppliedAt.toISOString()
				}
			]);
		}
		finally {
			secondTaskDatabase.close();
		}
	});
});
