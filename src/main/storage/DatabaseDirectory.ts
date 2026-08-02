import { accessSync, constants, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { STORAGE_CONFIG } from 'src/config/AppConfig';

export type DatabaseDirectoryValidation = {
	ok: true;
} | {
	ok: false;
	message: string;
};

export const createMissingDatabaseDirectoryMessage = (directory: string): string => {
	return `The task database folder "${directory}" does not exist. It may have been deleted, renamed, or it may be on a drive that is not currently available.`;
};

export const createUnusableDatabaseDirectoryMessage = (directory: string): string => {
	return `The task database folder "${directory}" cannot be read and written by SPOT.`;
};

export const createNotADatabaseDirectoryMessage = (directory: string): string => {
	return `The task database path "${directory}" is not a folder.`;
};

export const validateDatabaseDirectory = (directory: string): DatabaseDirectoryValidation => {
	if(!directory) {
		return {
			ok: false,
			message: 'No task database folder is selected.'
		};
	}

	if(!existsSync(directory)) {
		return {
			ok: false,
			message: createMissingDatabaseDirectoryMessage(directory)
		};
	}

	try {
		if(!statSync(directory).isDirectory()) {
			return {
				ok: false,
				message: createNotADatabaseDirectoryMessage(directory)
			};
		}

		accessSync(directory, constants.R_OK);
		accessSync(directory, constants.W_OK);
	}
	catch {
		return {
			ok: false,
			message: createUnusableDatabaseDirectoryMessage(directory)
		};
	}

	return {
		ok: true
	};
};

export const hasExistingSpotDatabase = (directory: string): boolean => {
	return existsSync(path.join(directory, STORAGE_CONFIG.databaseFileName));
};

export const ensureDatabaseDirectory = (directory: string): void => {
	mkdirSync(directory, { recursive: true });
};
