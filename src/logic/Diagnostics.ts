import { getErrorMessage } from 'src/framework/utils/ErrorUtils';
import type { DiagnosticsReportResult, SpotDiagnosticsApi } from 'src/types/DiagnosticsTypes';
import type { TaskStateAuditReport } from 'src/types/TaskAuditTypes';

/**
 * What the renderer can leave behind of a failure it can explain but not fix.
 *
 * The only trace the renderer can write by itself is a developer console an installed SPOT has no way of opening, and which is gone
 * with the window either way. Everything reported here therefore goes to the main process, which writes it to the operational log and
 * answers with the file it wrote it to, so the message the user is looking at can name a file they can actually open.
 */

// A report that cannot be handed over is one place less to read the details in, never a failure of its own: the caller is already
// showing the user something worse, and a diagnostics call that threw on top of it would replace what it was reporting.
const reportToOperationalLog = async(report: (spotDiagnostics: SpotDiagnosticsApi) => Promise<DiagnosticsReportResult>): Promise<string | undefined> => {
	const spotDiagnostics = window.spotDiagnostics as SpotDiagnosticsApi | undefined;

	if(!spotDiagnostics) {
		return undefined;
	}

	try {
		const { logFilePath } = await report(spotDiagnostics);

		return logFilePath;
	}
	catch {
		return undefined;
	}
};

/**
 * Reports what the task state audit found.
 * @param report Audit report to write.
 * @returns The log file it was written to, or undefined when it could not be written.
 */
export const reportTaskStateDrift = (report: TaskStateAuditReport): Promise<string | undefined> => {
	return reportToOperationalLog((spotDiagnostics) => {
		return spotDiagnostics.reportTaskStateDrift(report);
	});
};

/**
 * Reports the render error that left the window with nothing to show.
 * The thrown value is reduced to strings here: anything can be thrown, and IPC only carries what can be cloned.
 * @param error Value the render threw.
 * @param componentStack Component stack React caught it with.
 * @returns The log file it was written to, or undefined when it could not be written.
 */
export const reportRenderError = (error: unknown, componentStack: string | undefined): Promise<string | undefined> => {
	return reportToOperationalLog((spotDiagnostics) => {
		return spotDiagnostics.reportRenderError({
			message: getErrorMessage(error),
			stack: error instanceof Error ? error.stack : undefined,
			componentStack
		});
	});
};
