import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electronLog from 'electron-log';

export const SPOT_LOG_FILE_NAME = 'spot-logs.ndjson';

export const SPOT_LOG_MAX_FILE_SIZE_BYTES = 1024 * 1024;

export const SPOT_LOG_RETAINED_ARCHIVE_COUNT = 1;

export const SPOT_LOG_MAX_WRITE_ATTEMPTS = 3;

export const SPOT_LOG_RETRY_DELAY_MS = 25;

export const SPOT_LOG_WRITE_FAILED_MESSAGE = 'SPOT logging is unavailable.';

export const SPOT_LOGGER_NOT_INITIALIZED_MESSAGE = 'SPOT logging has not been initialized.';

export type SpotLogLevel = 'info' | 'warn' | 'error' | 'debug';

type SpotElectronLogLevel = SpotLogLevel | 'verbose' | 'silly' | false;

export type SpotLogFields = {
	type?: string;
	[field: string]: unknown;
};

export interface SpotLogEntry extends SpotLogFields {
	createdAt: string;
	level: SpotLogLevel;
	message: string;
}

interface SpotLogTransport {
	level: SpotElectronLogLevel;
}

interface SpotLogFileTransport extends SpotLogTransport {
	fileName: string;
	format: (params: { data: unknown[] }) => unknown[];
	maxSize: number;
	resolvePathFn: () => string;
	sync: boolean;
}

export interface SpotLoggerBackend {
	debug: (message: string) => void;
	error: (message: string) => void;
	info: (message: string) => void;
	warn: (message: string) => void;
	transports: {
		console?: SpotLogTransport | null;
		file: SpotLogFileTransport;
		ipc?: SpotLogTransport | null;
		remote?: SpotLogTransport | null;
	};
}

export type CreateSpotLoggerBackend = (logId: string) => SpotLoggerBackend;

export interface SpotLoggerConfiguration {
	filePath: string;
	fileName: string;
	maximumFileSizeBytes: number;
	retainedArchiveCount: number;
	maximumWriteAttempts: number;
	retryDelayMs: number;
}

export interface SpotLoggerHealthyStatus {
	state: 'healthy';
}

export interface SpotLoggerUnavailableStatus {
	state: 'unavailable';
	message: string;
}

export type SpotLoggerStatus = SpotLoggerHealthyStatus | SpotLoggerUnavailableStatus;

export interface CreateSpotLoggerOptions {
	storageDirectory: string;
	maximumFileSizeBytes?: number;
	maximumWriteAttempts?: number;
	retryDelayMs?: number;
	backendFactory?: CreateSpotLoggerBackend;
	now?: () => Date;
}

export interface SpotLogger {
	debug: (message: string, fields?: SpotLogFields) => void;
	error: (message: string, fields?: SpotLogFields) => void;
	info: (message: string, fields?: SpotLogFields) => void;
	warn: (message: string, fields?: SpotLogFields) => void;
	flush: () => Promise<void>;
	getStatus: () => SpotLoggerStatus;
	getConfiguration: () => SpotLoggerConfiguration;
}

const createElectronLoggerBackend: CreateSpotLoggerBackend = (logId) => {
	return electronLog.create({ logId }) as unknown as SpotLoggerBackend;
};

const createUninitializedSpotLogger = (): SpotLogger => {
	return {
		debug: () => {
			return undefined;
		},
		error: () => {
			return undefined;
		},
		info: () => {
			return undefined;
		},
		warn: () => {
			return undefined;
		},
		flush: () => {
			return Promise.resolve();
		},
		getStatus: () => {
			return {
				state: 'unavailable',
				message: SPOT_LOGGER_NOT_INITIALIZED_MESSAGE
			};
		},
		getConfiguration: () => {
			throw new Error(SPOT_LOGGER_NOT_INITIALIZED_MESSAGE);
		}
	};
};

let activeSpotLogger = createUninitializedSpotLogger();

export const spotLogger: SpotLogger = {
	debug: (message, fields) => {
		activeSpotLogger.debug(message, fields);
	},
	error: (message, fields) => {
		activeSpotLogger.error(message, fields);
	},
	info: (message, fields) => {
		activeSpotLogger.info(message, fields);
	},
	warn: (message, fields) => {
		activeSpotLogger.warn(message, fields);
	},
	flush: () => {
		return activeSpotLogger.flush();
	},
	getStatus: () => {
		return activeSpotLogger.getStatus();
	},
	getConfiguration: () => {
		return activeSpotLogger.getConfiguration();
	}
};

const createSpotLogId = (storageDirectory: string): string => {
	return `spot-logger-${storageDirectory.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
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

const configureLoggerBackend = (
	backend: SpotLoggerBackend,
	configuration: SpotLoggerConfiguration
): void => {
	if(backend.transports.console) {
		backend.transports.console.level = false;
	}
	if(backend.transports.ipc) {
		backend.transports.ipc.level = false;
	}
	if(backend.transports.remote) {
		backend.transports.remote.level = false;
	}

	backend.transports.file.level = 'debug';
	backend.transports.file.fileName = configuration.fileName;
	backend.transports.file.format = ({ data }) => {
		return [ String(data[0]) ];
	};
	backend.transports.file.maxSize = configuration.maximumFileSizeBytes;
	backend.transports.file.resolvePathFn = () => {
		return configuration.filePath;
	};
	backend.transports.file.sync = true;
};

const createLogEntry = (
	level: SpotLogLevel,
	message: string,
	fields: SpotLogFields | undefined,
	now: () => Date
): SpotLogEntry => {
	return {
		...fields,
		createdAt: now().toISOString(),
		level,
		message
	};
};

const serializeLogEntry = (entry: SpotLogEntry): string => {
	return JSON.stringify(entry);
};

const assertCurrentLogEndsWithLine = (filePath: string, line: string): void => {
	if(!existsSync(filePath)) {
		throw new Error(`SPOT log file "${filePath}" was not written.`);
	}

	const content = readFileSync(filePath, 'utf8');
	if(!content.endsWith(`${line}${os.EOL}`)) {
		throw new Error(`SPOT log file "${filePath}" did not receive the expected line.`);
	}
};

const assertLogFileWritable = (storageDirectory: string, filePath: string): void => {
	mkdirSync(storageDirectory, { recursive: true });

	const fileDescriptor = openSync(filePath, 'a');
	closeSync(fileDescriptor);
};

const createStartupFailureMessage = (filePath: string, error: unknown): string => {
	return `${SPOT_LOG_WRITE_FAILED_MESSAGE} Could not open "${filePath}" for appending. ${getErrorMessage(error)}`;
};

const getStartupFailureMessage = (storageDirectory: string, filePath: string): string | undefined => {
	try {
		assertLogFileWritable(storageDirectory, filePath);
		return undefined;
	}
	catch(error) {
		return createStartupFailureMessage(filePath, error);
	}
};

export const createSpotLogger = ({
	storageDirectory,
	maximumFileSizeBytes = SPOT_LOG_MAX_FILE_SIZE_BYTES,
	maximumWriteAttempts = SPOT_LOG_MAX_WRITE_ATTEMPTS,
	retryDelayMs = SPOT_LOG_RETRY_DELAY_MS,
	backendFactory = createElectronLoggerBackend,
	now = () => {
		return new Date();
	}
}: CreateSpotLoggerOptions): SpotLogger => {
	const configuration: SpotLoggerConfiguration = {
		filePath: path.join(storageDirectory, SPOT_LOG_FILE_NAME),
		fileName: SPOT_LOG_FILE_NAME,
		maximumFileSizeBytes,
		retainedArchiveCount: SPOT_LOG_RETAINED_ARCHIVE_COUNT,
		maximumWriteAttempts,
		retryDelayMs
	};
	const backend = backendFactory(createSpotLogId(storageDirectory));
	const pendingWrites = new Set<Promise<void>>();

	configureLoggerBackend(backend, configuration);
	const startupFailureMessage = getStartupFailureMessage(storageDirectory, configuration.filePath);

	const getStatus = (): SpotLoggerStatus => {
		if(startupFailureMessage) {
			return {
				state: 'unavailable',
				message: startupFailureMessage
			};
		}

		return {
			state: 'healthy'
		};
	};

	const write = async(
		level: SpotLogLevel,
		message: string,
		fields?: SpotLogFields
	): Promise<void> => {
		for(let attempt = 1; attempt <= maximumWriteAttempts; attempt += 1) {
			try {
				const serializedEntry = serializeLogEntry(createLogEntry(level, message, fields, now));

				backend[level](serializedEntry);
				assertCurrentLogEndsWithLine(configuration.filePath, serializedEntry);

				return;
			}
			catch {
				if(attempt < maximumWriteAttempts) {
					await sleep(retryDelayMs);
				}
			}
		}
	};

	const queueWrite = (
		level: SpotLogLevel,
		message: string,
		fields?: SpotLogFields
	): void => {
		const pendingWrite = write(level, message, fields).finally(() => {
			pendingWrites.delete(pendingWrite);
		});
		pendingWrites.add(pendingWrite);
	};

	const flush = async(): Promise<void> => {
		await Promise.allSettled(Array.from(pendingWrites));
	};

	return {
		debug: (message, fields) => {
			queueWrite('debug', message, fields);
		},
		error: (message, fields) => {
			queueWrite('error', message, fields);
		},
		info: (message, fields) => {
			queueWrite('info', message, fields);
		},
		warn: (message, fields) => {
			queueWrite('warn', message, fields);
		},
		flush,
		getStatus,
		getConfiguration: () => {
			return configuration;
		}
	};
};

export const initializeSpotLogger = (options: CreateSpotLoggerOptions): SpotLogger => {
	activeSpotLogger = createSpotLogger(options);

	return activeSpotLogger;
};

export const resetSpotLoggerForTests = (): void => {
	activeSpotLogger = createUninitializedSpotLogger();
};
