import { accessSync, constants, existsSync, mkdirSync, statSync } from 'node:fs';

export type BackupDirectoryValidation = {
	ok: true;
} | {
	ok: false;
	message: string;
};

export const createMissingBackupDirectoryMessage = (directory: string): string => {
	return `The backup folder "${directory}" does not exist. It may have been deleted, renamed, or it may be on a drive that is not currently available.`;
};

export const createUnusableBackupDirectoryMessage = (directory: string): string => {
	return `The backup folder "${directory}" cannot be read and written by SPOT.`;
};

export const createNotABackupDirectoryMessage = (directory: string): string => {
	return `The backup path "${directory}" is not a folder.`;
};

export const validateBackupDirectory = (directory: string): BackupDirectoryValidation => {
	if(!directory) {
		return {
			ok: false,
			message: 'No backup folder is selected.'
		};
	}

	if(!existsSync(directory)) {
		return {
			ok: false,
			message: createMissingBackupDirectoryMessage(directory)
		};
	}

	try {
		if(!statSync(directory).isDirectory()) {
			return {
				ok: false,
				message: createNotABackupDirectoryMessage(directory)
			};
		}

		accessSync(directory, constants.R_OK);
		accessSync(directory, constants.W_OK);
	}
	catch {
		return {
			ok: false,
			message: createUnusableBackupDirectoryMessage(directory)
		};
	}

	return {
		ok: true
	};
};

export const ensureBackupDirectory = (directory: string): void => {
	mkdirSync(directory, { recursive: true });
};
