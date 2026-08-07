import type { IpcMain } from 'electron';
import { AUDIT_CONFIG } from 'src/config/AppConfig';
import { appLogger } from 'src/framework/main/logging/AppLogger';
import { SPOT_DIAGNOSTICS_IPC_CHANNELS } from 'src/types/DiagnosticsIpcChannels';
import type { TaskStateDriftReportResult } from 'src/types/DiagnosticsTypes';
import type { TaskStateAuditReport } from 'src/types/TaskAuditTypes';

export { SPOT_DIAGNOSTICS_IPC_CHANNELS } from 'src/types/DiagnosticsIpcChannels';

// The line the operational log is searched for afterwards, so it stays in English and stays the same wording as the entry type
const TASK_STATE_DRIFT_LOG_MESSAGE = 'The tasks on screen and the tasks in the database are not the same';

type DiagnosticsIpcMain = Pick<IpcMain, 'handle'>;

export interface RegisterDiagnosticsIpcHandlersOptions {
	ipcMain: DiagnosticsIpcMain;
}

// A file the logger could not open is not named: the notice would send the user to a file that is not there. It says the details are
// in the log file either way, because a report that was not written is still a report the running application cannot show.
const getLogFilePath = (): string | undefined => {
	if(appLogger.getStatus().state !== 'healthy') {
		return undefined;
	}

	return appLogger.getConfiguration().filePath;
};

// Registers the renderer's way into the operational log. The audit runs in the renderer, which can only reach a developer console a
// packaged SPOT does not have, so what it found is written here instead: the log file outlives the session, and it is the only place
// the tasks and the fields behind the notice can still be read. The entry is bounded to what the audit itself reports, so a drift can
// never write the whole task list to disk.
export const registerDiagnosticsIpcHandlers = ({ ipcMain }: RegisterDiagnosticsIpcHandlersOptions): void => {
	ipcMain.handle(SPOT_DIAGNOSTICS_IPC_CHANNELS.reportTaskStateDrift, (_event, report: TaskStateAuditReport): TaskStateDriftReportResult => {
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
};
