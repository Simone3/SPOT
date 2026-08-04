export interface BackupLocation {
	directory: string;
	defaultDirectory: string;
	databaseDirectory: string;
	databasePath: string;
	isDevelopment: boolean;

	// Set when the configured folder could not be used and SPOT fell back to the default one
	message?: string;
}

export type ChooseBackupDirectoryResult = {
	ok: true;
	directory: string;
} | {
	ok: false;
	reason: 'cancelled' | 'invalid-directory';
	message?: string;
};

export type SetBackupDirectoryResult = {
	ok: true;
	location: BackupLocation;
} | {
	ok: false;
	message: string;
	location: BackupLocation;
};

export interface SpotBackupLocationApi {
	getBackupLocation: () => Promise<BackupLocation>;
	chooseBackupDirectory: () => Promise<ChooseBackupDirectoryResult>;
	setBackupDirectory: (directory: string) => Promise<SetBackupDirectoryResult>;
	setDefaultBackupDirectory: () => Promise<SetBackupDirectoryResult>;
}
