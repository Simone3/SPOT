import { LOGGING_CONFIG } from 'src/config/AppConfig';
import { createAppLogger, initializeAppLogger, type AppLogger, type CreateAppLoggerOptions } from 'src/framework/main/logging/AppLogger';

type LoggerTestOptions = Partial<CreateAppLoggerOptions> & Pick<CreateAppLoggerOptions, 'logDirectory'>;

// The framework logger takes every setting from its caller, so SPOT tests start from the settings SPOT itself uses
export const createSpotTestLoggerOptions = (options: LoggerTestOptions): CreateAppLoggerOptions => {
	return {
		fileName: LOGGING_CONFIG.fileName,
		maximumFileSizeBytes: LOGGING_CONFIG.maximumFileSizeBytes,
		retainedArchiveCount: LOGGING_CONFIG.retainedArchiveCount,
		maximumWriteAttempts: LOGGING_CONFIG.maximumWriteAttempts,
		retryDelayMs: LOGGING_CONFIG.retryDelayMs,
		...options
	};
};

export const createSpotTestLogger = (options: LoggerTestOptions): AppLogger => {
	return createAppLogger(createSpotTestLoggerOptions(options));
};

export const initializeSpotTestLogger = (options: LoggerTestOptions): AppLogger => {
	return initializeAppLogger(createSpotTestLoggerOptions(options));
};
