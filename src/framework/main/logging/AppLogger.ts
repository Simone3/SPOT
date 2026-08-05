import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electronLog from 'electron-log';
import { getErrorMessage } from 'src/framework/utils/ErrorUtils';

export const LOG_WRITE_FAILED_MESSAGE = 'Logging is unavailable.';

export const LOGGER_NOT_INITIALIZED_MESSAGE = 'Logging has not been initialized.';

export type AppLogLevel = 'info' | 'warn' | 'error' | 'debug';

type ElectronLogLevel = AppLogLevel | 'verbose' | 'silly' | false;

export type AppLogFields = {
	type?: string;
	[field: string]: unknown;
};

export interface AppLogEntry extends AppLogFields {
	createdAt: string;
	level: AppLogLevel;
	message: string;
}

interface AppLogTransport {
	level: ElectronLogLevel;
}

interface AppLogFileTransport extends AppLogTransport {
	fileName: string;
	format: (params: { data: unknown[] }) => unknown[];
	maxSize: number;
	resolvePathFn: () => string;
	sync: boolean;
}

export interface AppLoggerBackend {
	debug: (message: string) => void;
	error: (message: string) => void;
	info: (message: string) => void;
	warn: (message: string) => void;
	transports: {
		console?: AppLogTransport | null;
		file: AppLogFileTransport;
		ipc?: AppLogTransport | null;
		remote?: AppLogTransport | null;
	};
}

export type CreateAppLoggerBackend = (logId: string) => AppLoggerBackend;

export interface AppLoggerConfiguration {
	filePath: string;
	fileName: string;
	maximumFileSizeBytes: number;
	retainedArchiveCount: number;
	maximumWriteAttempts: number;
	retryDelayMs: number;
}

export interface AppLoggerHealthyStatus {
	state: 'healthy';
}

export interface AppLoggerUnavailableStatus {
	state: 'unavailable';
	message: string;
}

export type AppLoggerStatus = AppLoggerHealthyStatus | AppLoggerUnavailableStatus;

export interface CreateAppLoggerOptions {
	logDirectory: string;
	fileName: string;
	maximumFileSizeBytes: number;
	retainedArchiveCount: number;
	maximumWriteAttempts: number;
	retryDelayMs: number;
	backendFactory?: CreateAppLoggerBackend;
	now?: () => Date;
}

export interface AppLogger {
	debug: (message: string, fields?: AppLogFields) => void;
	error: (message: string, fields?: AppLogFields) => void;
	info: (message: string, fields?: AppLogFields) => void;
	warn: (message: string, fields?: AppLogFields) => void;
	flush: () => Promise<void>;
	getStatus: () => AppLoggerStatus;
	getConfiguration: () => AppLoggerConfiguration;
}

const createElectronLoggerBackend: CreateAppLoggerBackend = (logId) => {
	return electronLog.create({ logId }) as unknown as AppLoggerBackend;
};

const createUninitializedAppLogger = (): AppLogger => {
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
				message: LOGGER_NOT_INITIALIZED_MESSAGE
			};
		},
		getConfiguration: () => {
			throw new Error(LOGGER_NOT_INITIALIZED_MESSAGE);
		}
	};
};

let activeAppLogger = createUninitializedAppLogger();

// The process-wide logger. Every module writes through this handle, so that logging can be initialized once at startup without threading a logger through every call.
export const appLogger: AppLogger = {
	debug: (message, fields) => {
		activeAppLogger.debug(message, fields);
	},
	error: (message, fields) => {
		activeAppLogger.error(message, fields);
	},
	info: (message, fields) => {
		activeAppLogger.info(message, fields);
	},
	warn: (message, fields) => {
		activeAppLogger.warn(message, fields);
	},
	flush: () => {
		return activeAppLogger.flush();
	},
	getStatus: () => {
		return activeAppLogger.getStatus();
	},
	getConfiguration: () => {
		return activeAppLogger.getConfiguration();
	}
};

const createLogId = (logDirectory: string): string => {
	return `app-logger-${logDirectory.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
};

const sleep = (durationMs: number): Promise<void> => {
	if(durationMs <= 0) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});
};

const configureLoggerBackend = (
	backend: AppLoggerBackend,
	configuration: AppLoggerConfiguration
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
	level: AppLogLevel,
	message: string,
	fields: AppLogFields | undefined,
	now: () => Date
): AppLogEntry => {
	return {
		createdAt: now().toISOString(),
		level,
		message,
		...fields
	};
};

const serializeLogEntry = (entry: AppLogEntry): string => {
	return JSON.stringify(entry);
};

const assertCurrentLogEndsWithLine = (filePath: string, line: string): void => {
	if(!existsSync(filePath)) {
		throw new Error(`Log file "${filePath}" was not written.`);
	}

	const content = readFileSync(filePath, 'utf8');
	if(!content.endsWith(`${line}${os.EOL}`)) {
		throw new Error(`Log file "${filePath}" did not receive the expected line.`);
	}
};

const assertLogFileWritable = (logDirectory: string, filePath: string): void => {
	mkdirSync(logDirectory, { recursive: true });

	const fileDescriptor = openSync(filePath, 'a');
	closeSync(fileDescriptor);
};

const createStartupFailureMessage = (filePath: string, error: unknown): string => {
	return `${LOG_WRITE_FAILED_MESSAGE} Could not open "${filePath}" for appending. ${getErrorMessage(error)}`;
};

const getStartupFailureMessage = (logDirectory: string, filePath: string): string | undefined => {
	try {
		assertLogFileWritable(logDirectory, filePath);
		return undefined;
	}
	catch(error) {
		return createStartupFailureMessage(filePath, error);
	}
};

export const createAppLogger = ({
	logDirectory,
	fileName,
	maximumFileSizeBytes,
	retainedArchiveCount,
	maximumWriteAttempts,
	retryDelayMs,
	backendFactory = createElectronLoggerBackend,
	now = () => {
		return new Date();
	}
}: CreateAppLoggerOptions): AppLogger => {
	const configuration: AppLoggerConfiguration = {
		filePath: path.join(logDirectory, fileName),
		fileName,
		maximumFileSizeBytes,
		retainedArchiveCount,
		maximumWriteAttempts,
		retryDelayMs
	};
	const backend = backendFactory(createLogId(logDirectory));
	const pendingWrites = new Set<Promise<void>>();

	configureLoggerBackend(backend, configuration);
	const startupFailureMessage = getStartupFailureMessage(logDirectory, configuration.filePath);

	const getStatus = (): AppLoggerStatus => {
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
		level: AppLogLevel,
		message: string,
		fields?: AppLogFields
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
		level: AppLogLevel,
		message: string,
		fields?: AppLogFields
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

export const initializeAppLogger = (options: CreateAppLoggerOptions): AppLogger => {
	activeAppLogger = createAppLogger(options);

	return activeAppLogger;
};

export const resetAppLoggerForTests = (): void => {
	activeAppLogger = createUninitializedAppLogger();
};
