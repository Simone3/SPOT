export type DatabaseLocationState = 'unconfigured' | 'configured';

export interface DatabaseLocation {
	state: DatabaseLocationState;
	directory?: string;
	defaultDirectory: string;
	isDevelopment: boolean;
	message?: string;
}

export type ChooseDatabaseDirectoryResult = {
	ok: true;
	directory: string;
	hasExistingDatabase: boolean;
} | {
	ok: false;
	reason: 'cancelled' | 'invalid-directory';
	message?: string;
};

export type SetDatabaseDirectoryResult = {
	ok: true;
	location: DatabaseLocation;
} | {
	ok: false;
	message: string;
	location: DatabaseLocation;
};

export interface SpotDatabaseLocationApi {
	getDatabaseLocation: () => Promise<DatabaseLocation>;
	chooseDatabaseDirectory: () => Promise<ChooseDatabaseDirectoryResult>;
	setDatabaseDirectory: (directory: string) => Promise<SetDatabaseDirectoryResult>;
	setDefaultDatabaseDirectory: () => Promise<SetDatabaseDirectoryResult>;
}
