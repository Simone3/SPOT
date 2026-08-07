import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { initializeSpotTestLogger } from '../testUtils';
import { AUDIT_CONFIG, DIAGNOSTICS_CONFIG, LOGGING_CONFIG } from 'src/config/AppConfig';
import { resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { registerDiagnosticsIpcHandlers, SPOT_DIAGNOSTICS_IPC_CHANNELS } from 'src/main/ipc/DiagnosticsIpc';
import type { DiagnosticsReportResult, RenderErrorReport } from 'src/types/DiagnosticsTypes';
import type { TaskStateAuditDifference, TaskStateAuditReport } from 'src/types/TaskAuditTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

const createMockIpcMain = (): {
	handlers: Map<string, RegisteredIpcHandler>;
	ipcMain: Pick<IpcMain, 'handle'>;
} => {
	const handlers = new Map<string, RegisteredIpcHandler>();
	const ipcMain = {
		handle: vi.fn((channel: string, handler: RegisteredIpcHandler) => {
			handlers.set(channel, handler);
		})
	};

	return {
		handlers,
		ipcMain
	};
};

const createReport = (differences: TaskStateAuditDifference[]): TaskStateAuditReport => {
	return {
		isAligned: false,
		stateTaskCount: 4,
		databaseTaskCount: 3,
		differenceCount: differences.length,
		differences
	};
};

const readLogEntries = (logDirectory: string): Record<string, unknown>[] => {
	return readFileSync(path.join(logDirectory, LOGGING_CONFIG.fileName), 'utf8')
		.split('\n')
		.filter((line) => {
			return line.length > 0;
		})
		.map((line) => {
			return JSON.parse(line) as Record<string, unknown>;
		});
};

describe('DiagnosticsIpc', () => {
	let logDirectory: string;

	beforeEach(() => {
		logDirectory = mkdtempSync(path.join(tmpdir(), 'spot-diagnostics-'));
	});

	afterEach(() => {
		resetAppLoggerForTests();
		rmSync(logDirectory, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	test('registers the reporting channels', () => {
		const { handlers, ipcMain } = createMockIpcMain();

		registerDiagnosticsIpcHandlers({ ipcMain });

		expect([ ...handlers.keys() ]).toEqual([
			SPOT_DIAGNOSTICS_IPC_CHANNELS.reportTaskStateDrift,
			SPOT_DIAGNOSTICS_IPC_CHANNELS.reportRenderError
		]);
	});

	// The notice can only say how much drifted, so the tasks and the fields behind it have to survive the session in the log file
	test('writes the reported drift to the operational log and answers with the file it wrote it to', () => {
		const { handlers, ipcMain } = createMockIpcMain();
		initializeSpotTestLogger({ logDirectory });

		registerDiagnosticsIpcHandlers({ ipcMain });

		const result = handlers.get(SPOT_DIAGNOSTICS_IPC_CHANNELS.reportTaskStateDrift)!({} as IpcMainInvokeEvent, createReport([{
			taskId: 'drifted-task',
			taskText: 'Drifted task',
			reason: 'different-values',
			fieldNames: [ 'text' ]
		}])) as DiagnosticsReportResult;

		expect(result.logFilePath).toBe(path.join(logDirectory, LOGGING_CONFIG.fileName));

		const [ entry ] = readLogEntries(logDirectory);

		expect(entry).toMatchObject({
			level: 'warn',
			type: 'task.audit',
			stateTaskCount: 4,
			databaseTaskCount: 3,
			differenceCount: 1,
			differences: [{
				taskId: 'drifted-task',
				taskText: 'Drifted task',
				reason: 'different-values',
				fieldNames: [ 'text' ]
			}]
		});
	});

	// The whole task list must never end up on one log line, whatever the renderer hands over
	test('writes no more differences than the audit reports', () => {
		const { handlers, ipcMain } = createMockIpcMain();
		initializeSpotTestLogger({ logDirectory });

		registerDiagnosticsIpcHandlers({ ipcMain });

		handlers.get(SPOT_DIAGNOSTICS_IPC_CHANNELS.reportTaskStateDrift)!({} as IpcMainInvokeEvent, createReport(
			Array.from({ length: AUDIT_CONFIG.maximumReportedTasks + 10 }, (_value, index) => {
				return {
					taskId: `task-${index}`,
					taskText: `Task ${index}`,
					reason: 'missing-in-database' as const
				};
			})
		));

		const [ entry ] = readLogEntries(logDirectory);

		expect(entry.differences).toHaveLength(AUDIT_CONFIG.maximumReportedTasks);
		expect(entry.differenceCount).toBe(AUDIT_CONFIG.maximumReportedTasks + 10);
	});

	// The window is showing the crash screen at that point, so the log file is the only trace of what put it there
	test('writes the reported render error to the operational log', () => {
		const { handlers, ipcMain } = createMockIpcMain();
		initializeSpotTestLogger({ logDirectory });

		registerDiagnosticsIpcHandlers({ ipcMain });

		const result = handlers.get(SPOT_DIAGNOSTICS_IPC_CHANNELS.reportRenderError)!({} as IpcMainInvokeEvent, {
			message: 'The task list could not be rendered',
			stack: 'Error: The task list could not be rendered\n    at TasksList',
			componentStack: '    at TasksList\n    at TasksPage'
		} satisfies RenderErrorReport) as DiagnosticsReportResult;

		expect(result.logFilePath).toBe(path.join(logDirectory, LOGGING_CONFIG.fileName));

		const [ entry ] = readLogEntries(logDirectory);

		expect(entry).toMatchObject({
			level: 'error',
			type: 'renderer.error',
			error: 'The task list could not be rendered',
			stack: 'Error: The task list could not be rendered\n    at TasksList',
			componentStack: '    at TasksList\n    at TasksPage'
		});
	});

	// A stack the renderer hands over as it is must not be able to grow one log line without limit
	test('bounds the reported render error text', () => {
		const { handlers, ipcMain } = createMockIpcMain();
		initializeSpotTestLogger({ logDirectory });

		registerDiagnosticsIpcHandlers({ ipcMain });

		handlers.get(SPOT_DIAGNOSTICS_IPC_CHANNELS.reportRenderError)!({} as IpcMainInvokeEvent, {
			message: 'Rendering failed',
			stack: 'x'.repeat(DIAGNOSTICS_CONFIG.maximumReportedTextLength + 500)
		} satisfies RenderErrorReport);

		const [ entry ] = readLogEntries(logDirectory);

		expect(entry.stack).toBe(`${'x'.repeat(DIAGNOSTICS_CONFIG.maximumReportedTextLength)}...`);
		expect(entry.error).toBe('Rendering failed');
	});

	// A file the logger could not open would send the user to a file that is not there
	test('names no file when logging is unavailable', () => {
		const { handlers, ipcMain } = createMockIpcMain();

		registerDiagnosticsIpcHandlers({ ipcMain });

		const result = handlers.get(SPOT_DIAGNOSTICS_IPC_CHANNELS.reportTaskStateDrift)!({} as IpcMainInvokeEvent, createReport([{
			taskId: 'drifted-task',
			taskText: 'Drifted task',
			reason: 'missing-in-database'
		}])) as DiagnosticsReportResult;

		expect(result.logFilePath).toBeUndefined();
	});
});
