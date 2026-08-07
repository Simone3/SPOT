import type { TaskStateAuditReport } from 'src/types/TaskAuditTypes';

// What the main process answers a reported drift with. The renderer has no log file of its own, so it is also how it learns where the
// details it just handed over ended up. The path is left out when logging is unavailable, and the notice then names no file.
export interface TaskStateDriftReportResult {
	logFilePath?: string;
}

// The renderer's way into the operational log. It carries what only a later reader of that file can act on, and nothing the running
// application itself needs, so it is kept apart from the storage API rather than folded into it.
export interface SpotDiagnosticsApi {
	reportTaskStateDrift: (report: TaskStateAuditReport) => Promise<TaskStateDriftReportResult>;
}
