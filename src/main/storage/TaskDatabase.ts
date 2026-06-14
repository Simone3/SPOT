import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { DatabaseSync } from 'node:sqlite';

export const DATABASE_FILE_NAME = 'spot.sqlite';

export const CURRENT_SCHEMA_VERSION = 1;

interface OpenTaskDatabaseOptions {
	storageDirectory: string;
	now?: () => Date;
	sqlLogger?: SqlQueryLogger;
}

export interface TaskDatabase {
	connection: DatabaseSync;
	databasePath: string;
	sqlLogger?: SqlQueryLogger;
	close: () => void;
	getAppliedMigrationVersions: () => number[];
}

export interface SqlQueryLogRecord {
	query: string;
	durationMs: number;
	result: 'success' | 'failure';
	error?: string;
}

export type SqlQueryLogger = (record: SqlQueryLogRecord) => void;

interface MigrationRow {
	version: number;
}

interface SQLiteModule {
	DatabaseSync: typeof DatabaseSync;
}

const getSQLiteModule = (): SQLiteModule => {
	const sqliteModule = process.getBuiltinModule('node:sqlite') as SQLiteModule | undefined;

	if(!sqliteModule) {
		throw new Error('The current Node runtime does not provide node:sqlite.');
	}

	return sqliteModule;
};

const normalizeSqlQuery = (query: string): string => {
	return query.trim().replace(/\s+/g, ' ');
};

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
};

export const runQuery = <T>(
	sqlLogger: SqlQueryLogger | undefined,
	query: string,
	callback: () => T
): T => {
	const startedAt = performance.now();

	try {
		const result = callback();

		sqlLogger?.({
			query: normalizeSqlQuery(query),
			durationMs: performance.now() - startedAt,
			result: 'success'
		});

		return result;
	}
	catch(error) {
		sqlLogger?.({
			query: normalizeSqlQuery(query),
			durationMs: performance.now() - startedAt,
			result: 'failure',
			error: getErrorMessage(error)
		});

		throw error;
	}
};

const createSchemaMigrationsTable = (connection: DatabaseSync, sqlLogger?: SqlQueryLogger): void => {
	const query = `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL
		)
	`;

	runQuery(sqlLogger, query, () => {
		connection.exec(query);
	});
};

const getAppliedMigrationVersions = (connection: DatabaseSync, sqlLogger?: SqlQueryLogger): number[] => {
	const query = `
		SELECT version
		FROM schema_migrations
		ORDER BY version ASC
	`;

	return runQuery(sqlLogger, query, () => {
		return connection.prepare(query).all().map((row) => {
			return (row as unknown as MigrationRow).version;
		});
	});
};

const runTransaction = (connection: DatabaseSync, sqlLogger: SqlQueryLogger | undefined, callback: () => void): void => {
	runQuery(sqlLogger, 'BEGIN', () => {
		connection.exec('BEGIN');
	});

	try {
		callback();
		runQuery(sqlLogger, 'COMMIT', () => {
			connection.exec('COMMIT');
		});
	}
	catch(error) {
		runQuery(sqlLogger, 'ROLLBACK', () => {
			connection.exec('ROLLBACK');
		});
		throw error;
	}
};

const applyVersionOneMigration = (connection: DatabaseSync, appliedAt: Date, sqlLogger?: SqlQueryLogger): void => {
	runTransaction(connection, sqlLogger, () => {
		const createTasksQuery = `
			CREATE TABLE IF NOT EXISTS tasks (
				id TEXT PRIMARY KEY,
				text TEXT NOT NULL,
				state TEXT NOT NULL,
				priority TEXT NOT NULL,
				owner TEXT,
				due_date TEXT,
				tags_json TEXT NOT NULL,
				sort_position INTEGER NOT NULL,
				completion_date TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)
		`;
		const insertMigrationQuery = `
			INSERT INTO schema_migrations (version, applied_at)
			VALUES (?, ?)
		`;

		runQuery(sqlLogger, createTasksQuery, () => {
			connection.exec(createTasksQuery);
		});

		runQuery(sqlLogger, insertMigrationQuery, () => {
			connection.prepare(insertMigrationQuery).run(CURRENT_SCHEMA_VERSION, appliedAt.toISOString());
		});
	});
};

const migrateTaskDatabase = (connection: DatabaseSync, now: () => Date, sqlLogger?: SqlQueryLogger): void => {
	createSchemaMigrationsTable(connection, sqlLogger);

	const appliedVersions = getAppliedMigrationVersions(connection, sqlLogger);
	const futureVersion = appliedVersions.find((version) => {
		return version > CURRENT_SCHEMA_VERSION;
	});
	if(futureVersion !== undefined) {
		throw new Error(`Unsupported task database schema version ${futureVersion}.`);
	}

	if(!appliedVersions.includes(CURRENT_SCHEMA_VERSION)) {
		applyVersionOneMigration(connection, now(), sqlLogger);
	}
};

export const openTaskDatabase = ({ storageDirectory, now = () => {
	return new Date();
}, sqlLogger }: OpenTaskDatabaseOptions): TaskDatabase => {
	mkdirSync(storageDirectory, { recursive: true });

	const databasePath = path.join(storageDirectory, DATABASE_FILE_NAME);
	const { DatabaseSync: DatabaseSyncConstructor } = getSQLiteModule();
	const connection = new DatabaseSyncConstructor(databasePath, {
		enableForeignKeyConstraints: true,
		allowExtension: false,
		timeout: 5000
	});

	try {
		migrateTaskDatabase(connection, now, sqlLogger);
	}
	catch(error) {
		connection.close();
		throw error;
	}

	return {
		connection,
		databasePath,
		sqlLogger,
		close: () => {
			connection.close();
		},
		getAppliedMigrationVersions: () => {
			return getAppliedMigrationVersions(connection, sqlLogger);
		}
	};
};
