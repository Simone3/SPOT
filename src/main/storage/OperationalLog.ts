import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electronLog from 'electron-log';
import type { OperationalLogEntry } from 'src/main/storage/TaskStorage';

export const OPERATIONAL_LOG_FILE_NAME = 'spot-logs.ndjson';

export const OPERATIONAL_LOG_MAX_FILE_SIZE_BYTES = 1024 * 1024;

export const OPERATIONAL_LOG_RETAINED_ARCHIVE_COUNT = 1;

export const OPERATIONAL_LOG_MAX_WRITE_ATTEMPTS = 3;

export const OPERATIONAL_LOG_RETRY_DELAY_MS = 25;

export const OPERATIONAL_LOG_WRITE_FAILED_MESSAGE = 'Operational logging is unavailable.';

type OperationalLogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly' | false;

interface OperationalLogTransport {
	level: OperationalLogLevel;
}

interface OperationalLogFileTransport extends OperationalLogTransport {
	fileName: string;
	format: (params: { data: unknown[] }) => unknown[];
	maxSize: number;
	resolvePathFn: () => string;
	sync: boolean;
}

export interface OperationalLogLogger {
	info: (message: string) => void;
	transports: {
		console?: OperationalLogTransport | null;
		file: OperationalLogFileTransport;
		ipc?: OperationalLogTransport | null;
		remote?: OperationalLogTransport | null;
	};
}

export type CreateOperationalLogLogger = (logId: string) => OperationalLogLogger;

export interface OperationalLogConfiguration {
	filePath: string;
	fileName: string;
	maximumFileSizeBytes: number;
	retainedArchiveCount: number;
	maximumWriteAttempts: number;
	retryDelayMs: number;
}

export interface OperationalLogStatus {
	state: 'healthy' | 'unavailable';
	message?: string;
}

export type OperationalLogWriteOutcome = {
	ok: true;
	status: OperationalLogStatus;
} | {
	ok: false;
	message: string;
	status: OperationalLogStatus;
};

export interface CreateOperationalLogOptions {
	storageDirectory: string;
	maximumFileSizeBytes?: number;
	maximumWriteAttempts?: number;
	retryDelayMs?: number;
	loggerFactory?: CreateOperationalLogLogger;
}

export interface OperationalLog {
	writeEntry: (entry: OperationalLogEntry) => Promise<OperationalLogWriteOutcome>;
	getStatus: () => OperationalLogStatus;
	getConfiguration: () => OperationalLogConfiguration;
}

const createElectronOperationalLogLogger: CreateOperationalLogLogger = (logId) => {
	return electronLog.create({ logId }) as unknown as OperationalLogLogger;
};

const createOperationalLogId = (storageDirectory: string): string => {
	return `spot-operational-${storageDirectory.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
};

const sleep = (durationMs: number): Promise<void> => {
	if(durationMs <= 0) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});
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

const configureLogger = (
	logger: OperationalLogLogger,
	configuration: OperationalLogConfiguration
): void => {
	if(logger.transports.console) {
		logger.transports.console.level = false;
	}
	if(logger.transports.ipc) {
		logger.transports.ipc.level = false;
	}
	if(logger.transports.remote) {
		logger.transports.remote.level = false;
	}

	logger.transports.file.level = 'info';
	logger.transports.file.fileName = configuration.fileName;
	logger.transports.file.format = ({ data }) => {
		return [ String(data[0]) ];
	};
	logger.transports.file.maxSize = configuration.maximumFileSizeBytes;
	logger.transports.file.resolvePathFn = () => {
		return configuration.filePath;
	};
	logger.transports.file.sync = true;
};

const serializeOperationalLogEntry = (entry: OperationalLogEntry): string => {
	return JSON.stringify(entry);
};

const assertCurrentLogEndsWithLine = (filePath: string, line: string): void => {
	if(!existsSync(filePath)) {
		throw new Error(`Operational log file "${filePath}" was not written.`);
	}

	const content = readFileSync(filePath, 'utf8');
	if(!content.endsWith(`${line}${os.EOL}`)) {
		throw new Error(`Operational log file "${filePath}" did not receive the expected line.`);
	}
};

const createFailureMessage = (maximumWriteAttempts: number, error: unknown): string => {
	return `${OPERATIONAL_LOG_WRITE_FAILED_MESSAGE} Failed after ${maximumWriteAttempts} write attempts. ${getErrorMessage(error)}`;
};

export const createOperationalLog = ({
	storageDirectory,
	maximumFileSizeBytes = OPERATIONAL_LOG_MAX_FILE_SIZE_BYTES,
	maximumWriteAttempts = OPERATIONAL_LOG_MAX_WRITE_ATTEMPTS,
	retryDelayMs = OPERATIONAL_LOG_RETRY_DELAY_MS,
	loggerFactory = createElectronOperationalLogLogger
}: CreateOperationalLogOptions): OperationalLog => {
	const configuration: OperationalLogConfiguration = {
		filePath: path.join(storageDirectory, OPERATIONAL_LOG_FILE_NAME),
		fileName: OPERATIONAL_LOG_FILE_NAME,
		maximumFileSizeBytes,
		retainedArchiveCount: OPERATIONAL_LOG_RETAINED_ARCHIVE_COUNT,
		maximumWriteAttempts,
		retryDelayMs
	};
	const logger = loggerFactory(createOperationalLogId(storageDirectory));
	let lastFailureMessage: string | undefined;

	configureLogger(logger, configuration);

	const getStatus = (): OperationalLogStatus => {
		if(lastFailureMessage) {
			return {
				state: 'unavailable',
				message: lastFailureMessage
			};
		}

		return {
			state: 'healthy'
		};
	};

	const writeEntry = async(entry: OperationalLogEntry): Promise<OperationalLogWriteOutcome> => {
		let lastError: unknown;

		for(let attempt = 1; attempt <= maximumWriteAttempts; attempt += 1) {
			try {
				const serializedEntry = serializeOperationalLogEntry(entry);

				logger.info(serializedEntry);
				assertCurrentLogEndsWithLine(configuration.filePath, serializedEntry);

				lastFailureMessage = undefined;
				return {
					ok: true,
					status: getStatus()
				};
			}
			catch(error) {
				lastError = error;

				if(attempt < maximumWriteAttempts) {
					await sleep(retryDelayMs);
				}
			}
		}

		lastFailureMessage = createFailureMessage(maximumWriteAttempts, lastError);
		return {
			ok: false,
			message: lastFailureMessage,
			status: getStatus()
		};
	};

	return {
		writeEntry,
		getStatus,
		getConfiguration: () => {
			return configuration;
		}
	};
};
