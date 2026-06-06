import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export const DATABASE_FILE_NAME = 'spot.sqlite';

export const CURRENT_SCHEMA_VERSION = 1;

interface OpenTaskDatabaseOptions {
	storageDirectory: string;
	now?: () => Date;
}

export interface TaskDatabase {
	connection: DatabaseSync;
	databasePath: string;
	close: () => void;
	getAppliedMigrationVersions: () => number[];
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

const createSchemaMigrationsTable = (connection: DatabaseSync): void => {
	connection.exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL
		)
	`);
};

const getAppliedMigrationVersions = (connection: DatabaseSync): number[] => {
	return connection.prepare(`
		SELECT version
		FROM schema_migrations
		ORDER BY version ASC
	`).all().map((row) => {
		return (row as unknown as MigrationRow).version;
	});
};

const runTransaction = (connection: DatabaseSync, callback: () => void): void => {
	connection.exec('BEGIN');

	try {
		callback();
		connection.exec('COMMIT');
	}
	catch(error) {
		connection.exec('ROLLBACK');
		throw error;
	}
};

const applyVersionOneMigration = (connection: DatabaseSync, appliedAt: Date): void => {
	runTransaction(connection, () => {
		connection.exec(`
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
		`);

		connection.prepare(`
			INSERT INTO schema_migrations (version, applied_at)
			VALUES (?, ?)
		`).run(CURRENT_SCHEMA_VERSION, appliedAt.toISOString());
	});
};

const migrateTaskDatabase = (connection: DatabaseSync, now: () => Date): void => {
	createSchemaMigrationsTable(connection);

	const appliedVersions = getAppliedMigrationVersions(connection);
	const futureVersion = appliedVersions.find((version) => {
		return version > CURRENT_SCHEMA_VERSION;
	});
	if(futureVersion !== undefined) {
		throw new Error(`Unsupported task database schema version ${futureVersion}.`);
	}

	if(!appliedVersions.includes(CURRENT_SCHEMA_VERSION)) {
		applyVersionOneMigration(connection, now());
	}
};

export const openTaskDatabase = ({ storageDirectory, now = () => {
	return new Date();
} }: OpenTaskDatabaseOptions): TaskDatabase => {
	mkdirSync(storageDirectory, { recursive: true });

	const databasePath = path.join(storageDirectory, DATABASE_FILE_NAME);
	const { DatabaseSync: DatabaseSyncConstructor } = getSQLiteModule();
	const connection = new DatabaseSyncConstructor(databasePath, {
		enableForeignKeyConstraints: true,
		allowExtension: false,
		timeout: 5000
	});

	try {
		migrateTaskDatabase(connection, now);
	}
	catch(error) {
		connection.close();
		throw error;
	}

	return {
		connection,
		databasePath,
		close: () => {
			connection.close();
		},
		getAppliedMigrationVersions: () => {
			return getAppliedMigrationVersions(connection);
		}
	};
};
