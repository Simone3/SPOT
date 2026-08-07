import type { TaskStateAuditReport } from 'src/types/TaskAuditTypes';

// What the main process answers a report with. The renderer has no log file of its own, so it is also how it learns where what it
// just handed over ended up. The path is left out when logging is unavailable, which is also when nothing was written.
export interface DiagnosticsReportResult {
	logFilePath?: string;
}

// A render error reduced to what survives the trip to the main process. The thrown value itself stays in the renderer: anything can be
// thrown, and IPC only carries what can be cloned.
export interface RenderErrorReport {
	message: string;
	stack?: string;
	componentStack?: string;
}

// The renderer's way into the operational log. It carries what only a later reader of that file can act on, and nothing the running
// application itself needs, so it is kept apart from the storage API rather than folded into it.
export interface SpotDiagnosticsApi {
	reportTaskStateDrift: (report: TaskStateAuditReport) => Promise<DiagnosticsReportResult>;
	reportRenderError: (renderError: RenderErrorReport) => Promise<DiagnosticsReportResult>;
}
