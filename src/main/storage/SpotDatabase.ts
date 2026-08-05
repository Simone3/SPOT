import { STORAGE_CONFIG } from 'src/config/AppConfig';
import { openAppDatabase, type AppDatabase, type DatabaseMigration } from 'src/framework/main/storage/AppDatabase';

export interface OpenSpotDatabaseOptions {
	storageDirectory: string;
	now?: () => Date;
}

const createTasksTable = (database: AppDatabase): void => {
	const query = `
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

	database.execQuery(query);
};

// The SPOT schema, one entry per version. A version is applied at most once and never changes afterwards: a schema change is a new entry.
export const SPOT_DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
	{
		version: STORAGE_CONFIG.currentSchemaVersion,
		apply: createTasksTable
	}
];

export const openSpotDatabase = ({ storageDirectory, now }: OpenSpotDatabaseOptions): AppDatabase => {
	return openAppDatabase({
		storageDirectory,
		databaseFileName: STORAGE_CONFIG.databaseFileName,
		migrations: SPOT_DATABASE_MIGRATIONS,
		timeoutMs: STORAGE_CONFIG.databaseTimeoutMs,
		now
	});
};
