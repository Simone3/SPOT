import type { IpcMain } from 'electron';
import { AUDIT_CONFIG, DIAGNOSTICS_CONFIG } from 'src/config/AppConfig';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { SPOT_DIAGNOSTICS_IPC_CHANNELS } from 'src/types/DiagnosticsIpcChannels';
import type { DiagnosticsReportResult, RenderErrorReport } from 'src/types/DiagnosticsTypes';
import type { TaskStateAuditReport } from 'src/types/TaskAuditTypes';

export { SPOT_DIAGNOSTICS_IPC_CHANNELS } from 'src/types/DiagnosticsIpcChannels';

// The lines the operational log is searched for afterwards, so they stay in English and stay the wording of the entry types
const TASK_STATE_DRIFT_LOG_MESSAGE = 'The tasks on screen and the tasks in the database are not the same';

const RENDER_ERROR_LOG_MESSAGE = 'A render error left the window with nothing to show';

type DiagnosticsIpcMain = Pick<IpcMain, 'handle'>;

export interface RegisterDiagnosticsIpcHandlersOptions {
	ipcMain: DiagnosticsIpcMain;
}

// A file the logger could not open is not named: the notice would send the user to a file that is not there. It is also the case in
// which nothing was written, so the renderer says the report could not be written rather than pointing anywhere.
const getLogFilePath = (): string | undefined => {
	if(appLogger.getStatus().state !== 'healthy') {
		return undefined;
	}

	return appLogger.getConfiguration().filePath;
};

const truncateReportedText = (text: string | undefined): string | undefined => {
	if(text === undefined || text.length <= DIAGNOSTICS_CONFIG.maximumReportedTextLength) {
		return text;
	}

	return `${text.slice(0, DIAGNOSTICS_CONFIG.maximumReportedTextLength)}...`;
};

// Registers the renderer's way into the operational log. The renderer can only reach a developer console, which a packaged SPOT has
// no way of opening and which outlives nothing, so what it reports is written here instead: the log file is the only place a drift or
// a render error can still be read after the session. Every entry is bounded, so nothing the renderer sends can grow one log line
// without limit, and the renderer chooses neither the message nor the level.
export const registerDiagnosticsIpcHandlers = ({ ipcMain }: RegisterDiagnosticsIpcHandlersOptions): void => {
	ipcMain.handle(SPOT_DIAGNOSTICS_IPC_CHANNELS.reportTaskStateDrift, (_event, report: TaskStateAuditReport): DiagnosticsReportResult => {
		appLogger.warn(TASK_STATE_DRIFT_LOG_MESSAGE, {
			type: 'task.audit',
			stateTaskCount: report.stateTaskCount,
			databaseTaskCount: report.databaseTaskCount,
			differenceCount: report.differenceCount,
			differences: report.differences.slice(0, AUDIT_CONFIG.maximumReportedTasks)
		});

		return {
			logFilePath: getLogFilePath()
		};
	});

	// The window is showing the crash screen at this point, so this is the one trace of what put it there
	ipcMain.handle(SPOT_DIAGNOSTICS_IPC_CHANNELS.reportRenderError, (_event, renderError: RenderErrorReport): DiagnosticsReportResult => {
		appLogger.error(RENDER_ERROR_LOG_MESSAGE, {
			type: 'renderer.error',
			error: truncateReportedText(renderError.message),
			stack: truncateReportedText(renderError.stack),
			componentStack: truncateReportedText(renderError.componentStack)
		});

		return {
			logFilePath: getLogFilePath()
		};
	});
};
