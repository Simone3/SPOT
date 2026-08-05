import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { STORAGE_CONFIG } from 'src/config/AppConfig';
import { spotLogger } from 'src/main/logging/SpotLogger';

interface OpenSpotDatabaseOptions {
	storageDirectory: string;
	now?: () => Date;
}

export type SpotSqlParameter = SQLInputValue;

export interface SpotDatabaseRunResult {
	changes: number | bigint;
	lastInsertRowid: number | bigint;
}

export interface SpotDatabase {
	databasePath: string;
	close: () => void;
	execQuery: (query: string) => void;
	runQuery: (query: string, ...parameters: SpotSqlParameter[]) => SpotDatabaseRunResult;
	getQuery: <TRow>(query: string, ...parameters: SpotSqlParameter[]) => TRow | undefined;
	getAllQueryRows: <TRow>(query: string, ...parameters: SpotSqlParameter[]) => TRow[];
	runTransaction: (callback: () => void) => void;
	vacuumInto: (targetPath: string) => void;
	getAppliedMigrationVersions: () => number[];
}

interface SqlQueryLogRecord {
	query: string;
	durationMs: number;
	result: 'success' | 'failure';
	error?: string;
}

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

const writeSqlQueryLogRecord = (record: SqlQueryLogRecord): void => {
	spotLogger[record.result === 'failure' ? 'error' : 'info']('Storage SQL query completed', {
		type: 'sql.query',
		query: record.query,
		elapsedMillis: Math.round(record.durationMs),
		result: record.result,
		error: record.error
	});
};

const logQuery = <T>(query: string, callback: () => T): T => {
	const startedAt = performance.now();

	try {
		const result = callback();

		writeSqlQueryLogRecord({
			query: normalizeSqlQuery(query),
			durationMs: performance.now() - startedAt,
			result: 'success'
		});

		return result;
	}
	catch(error) {
		writeSqlQueryLogRecord({
			query: normalizeSqlQuery(query),
			durationMs: performance.now() - startedAt,
			result: 'failure',
			error: getErrorMessage(error)
		});

		throw error;
	}
};

const createSpotDatabaseWrapper = (
	connection: DatabaseSync,
	databasePath: string
): SpotDatabase => {
	const execQuery = (query: string): void => {
		logQuery(query, () => {
			connection.exec(query);
		});
	};

	const runQuery = (query: string, ...parameters: SpotSqlParameter[]): SpotDatabaseRunResult => {
		return logQuery(query, () => {
			return connection.prepare(query).run(...parameters);
		});
	};

	const getQuery = <TRow>(query: string, ...parameters: SpotSqlParameter[]): TRow | undefined => {
		return logQuery(query, () => {
			return connection.prepare(query).get(...parameters) as unknown as TRow | undefined;
		});
	};

	const getAllQueryRows = <TRow>(query: string, ...parameters: SpotSqlParameter[]): TRow[] => {
		return logQuery(query, () => {
			return connection.prepare(query).all(...parameters) as unknown as TRow[];
		});
	};

	// Takes the write lock upfront, so a concurrent writer cannot make this transaction fail with an unrecoverable SQLITE_BUSY while upgrading from a read to a write
	const runTransaction = (callback: () => void): void => {
		execQuery('BEGIN IMMEDIATE');

		try {
			callback();
			execQuery('COMMIT');
		}
		catch(error) {
			// A failed rollback is already logged by the query logger, and it must not replace the error that actually broke the transaction, otherwise callers classify the wrong exception
			try {
				execQuery('ROLLBACK');
			}
			catch {
				// Intentionally ignored
			}

			throw error;
		}
	};

	// Writes a self-contained copy of the database, so a backup never has to reassemble the live file with its write-ahead log.
	// It opens its own read transaction, which is why it must not run while another transaction is open on this connection.
	const vacuumInto = (targetPath: string): void => {
		runQuery('VACUUM INTO ?', targetPath);
	};

	const getAppliedMigrationVersions = (): number[] => {
		const query = `
			SELECT version
			FROM schema_migrations
			ORDER BY version ASC
		`;

		return getAllQueryRows<MigrationRow>(query).map((row) => {
			return row.version;
		});
	};

	return {
		databasePath,
		close: () => {
			connection.close();
		},
		execQuery,
		runQuery,
		getQuery,
		getAllQueryRows,
		runTransaction,
		vacuumInto,
		getAppliedMigrationVersions
	};
};

const createSchemaMigrationsTable = (spotDatabase: SpotDatabase): void => {
	const query = `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL
		)
	`;

	spotDatabase.execQuery(query);
};

const applyVersionOneMigration = (spotDatabase: SpotDatabase, appliedAt: Date): void => {
	spotDatabase.runTransaction(() => {
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

		spotDatabase.execQuery(createTasksQuery);
		spotDatabase.runQuery(insertMigrationQuery, STORAGE_CONFIG.currentSchemaVersion, appliedAt.toISOString());
	});
};

const migrateSpotDatabase = (spotDatabase: SpotDatabase, now: () => Date): void => {
	createSchemaMigrationsTable(spotDatabase);

	const appliedVersions = spotDatabase.getAppliedMigrationVersions();
	const futureVersion = appliedVersions.find((version) => {
		return version > STORAGE_CONFIG.currentSchemaVersion;
	});
	if(futureVersion !== undefined) {
		throw new Error(`Unsupported SPOT database schema version ${futureVersion}.`);
	}

	if(!appliedVersions.includes(STORAGE_CONFIG.currentSchemaVersion)) {
		applyVersionOneMigration(spotDatabase, now());
	}
};

export const openSpotDatabase = ({ storageDirectory, now = () => {
	return new Date();
} }: OpenSpotDatabaseOptions): SpotDatabase => {
	mkdirSync(storageDirectory, { recursive: true });

	const databasePath = path.join(storageDirectory, STORAGE_CONFIG.databaseFileName);
	const { DatabaseSync: DatabaseSyncConstructor } = getSQLiteModule();
	const connection = new DatabaseSyncConstructor(databasePath, {
		enableForeignKeyConstraints: true,
		allowExtension: false,
		timeout: STORAGE_CONFIG.databaseTimeoutMs
	});
	const spotDatabase = createSpotDatabaseWrapper(connection, databasePath);

	try {
		// The database always lives on the local user-data disk, never in a synchronized folder, so the write-ahead log and its shared-memory file are safe to use
		spotDatabase.execQuery('PRAGMA journal_mode = WAL');
		migrateSpotDatabase(spotDatabase, now);
	}
	catch(error) {
		spotDatabase.close();
		throw error;
	}

	return spotDatabase;
};
