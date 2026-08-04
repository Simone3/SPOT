import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { BACKUP_CONFIG } from 'src/config/AppConfig';
import type { SpotDatabase } from 'src/main/storage/SpotDatabase';

export interface CreateDatabaseBackupOptions {
	database: SpotDatabase;
	backupDirectory: string;
	temporaryDirectory: string;
	now?: () => Date;
}

// Colons and dots cannot be used on every platform, and the remaining format still sorts the backups chronologically by name
export const createBackupFileName = (createdAt: Date): string => {
	const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');

	return `${BACKUP_CONFIG.filePrefix}${timestamp}${BACKUP_CONFIG.fileExtension}`;
};

export const isBackupFileName = (fileName: string): boolean => {
	return fileName.startsWith(BACKUP_CONFIG.filePrefix) && fileName.endsWith(BACKUP_CONFIG.fileExtension);
};

const isPartialBackupFileName = (fileName: string): boolean => {
	return fileName.startsWith(BACKUP_CONFIG.filePrefix) && fileName.endsWith(BACKUP_CONFIG.partialFileExtension);
};

const readBackupDirectoryFileNames = async(backupDirectory: string): Promise<string[]> => {
	try {
		return await readdir(backupDirectory);
	}
	catch {
		return [];
	}
};

export const readBackupFileNames = async(backupDirectory: string): Promise<string[]> => {
	return (await readBackupDirectoryFileNames(backupDirectory)).filter(isBackupFileName).sort();
};

// Shutdown abandons a backup that is taking too long, so the half-copied file it may leave behind is cleared by the next run
const removePartialBackupFiles = async(backupDirectory: string): Promise<void> => {
	const partialFileNames = (await readBackupDirectoryFileNames(backupDirectory)).filter(isPartialBackupFileName);

	await Promise.all(partialFileNames.map((fileName) => {
		return rm(path.join(backupDirectory, fileName), { force: true });
	}));
};

// Only the files SPOT itself wrote are removed, so anything else the user keeps in the backup folder is left alone
const pruneBackupFiles = async(backupDirectory: string): Promise<void> => {
	const backupFileNames = await readBackupFileNames(backupDirectory);
	const excessCount = backupFileNames.length - BACKUP_CONFIG.retainedBackupCount;

	if(excessCount <= 0) {
		return;
	}

	await Promise.all(backupFileNames.slice(0, excessCount).map((fileName) => {
		return rm(path.join(backupDirectory, fileName), { force: true });
	}));
};

// Writes one rotated backup copy of the live database into the backup folder. The snapshot is built on the local disk first and only then
// published, so the backup folder never holds a database that is still being written: a synchronization client watching that folder can
// therefore only ever see complete files.
export const createDatabaseBackup = async({ database, backupDirectory, temporaryDirectory, now = () => {
	return new Date();
} }: CreateDatabaseBackupOptions): Promise<string> => {
	const temporaryPath = path.join(temporaryDirectory, BACKUP_CONFIG.temporaryFileName);
	const backupPath = path.join(backupDirectory, createBackupFileName(now()));
	const partialBackupPath = `${backupPath}${BACKUP_CONFIG.partialFileExtension}`;

	await mkdir(temporaryDirectory, { recursive: true });
	await mkdir(backupDirectory, { recursive: true });
	await removePartialBackupFiles(backupDirectory);

	// VACUUM INTO refuses to write over an existing file, so a snapshot left behind by an interrupted backup is cleared first
	await rm(temporaryPath, { force: true });

	try {
		// Only this step touches the database, and it stays on the local disk: copying into a possibly slow backup folder happens afterwards
		database.vacuumInto(temporaryPath);

		await copyFile(temporaryPath, partialBackupPath);
		await rename(partialBackupPath, backupPath);
	}
	catch(error) {
		await rm(partialBackupPath, { force: true });

		throw error;
	}
	finally {
		await rm(temporaryPath, { force: true });
	}

	await pruneBackupFiles(backupDirectory);

	return backupPath;
};
