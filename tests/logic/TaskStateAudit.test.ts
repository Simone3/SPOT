import { makeTask, makeTranslator } from '../testUtils';
import { AUDIT_CONFIG } from 'src/config/AppConfig';
import { auditTaskState, createTaskStateAuditMessage } from 'src/logic/TaskStateAudit';

const translator = makeTranslator();

describe('TaskStateAudit', () => {
	test('reports nothing when both sides hold the same tasks', () => {
		const activeTask = makeTask({ text: 'Active' });
		const completedTask = makeTask({
			text: 'Completed',
			state: 'COMPLETED',
			completionDate: new Date('2026-05-01T10:00:00.000Z')
		});

		const report = auditTaskState([ activeTask, completedTask ], [ completedTask, activeTask ]);

		expect(report.isAligned).toBe(true);
		expect(report.differenceCount).toBe(0);
		expect(createTaskStateAuditMessage(report, translator)).toBeUndefined();
	});

	test('ignores the differences that are never stored', () => {
		const databaseTask = makeTask({
			owner: undefined,
			tags: [ 'work' ],
			visible: false
		});
		const stateTask = {
			...databaseTask,
			owner: '',
			tags: [ 'work', '' ],
			visible: true
		};

		expect(auditTaskState([ stateTask ], [ databaseTask ]).isAligned).toBe(true);
	});

	test('reports a task the database does not hold', () => {
		const storedTask = makeTask();
		const unstoredTask = makeTask({ text: 'Never written' });

		const report = auditTaskState([ storedTask, unstoredTask ], [ storedTask ]);

		expect(report.isAligned).toBe(false);
		expect(report.stateTaskCount).toBe(2);
		expect(report.databaseTaskCount).toBe(1);
		expect(report.differences).toEqual([{
			taskId: unstoredTask.id,
			taskText: 'Never written',
			reason: 'missing-in-database'
		}]);
		expect(createTaskStateAuditMessage(report, translator)).toContain('1 task not stored yet');
	});

	// The message only says how much drifted, so it has to say where the tasks and the fields behind it were written
	test('points at the log file the drift was written to', () => {
		const report = auditTaskState([ makeTask() ], []);

		expect(createTaskStateAuditMessage(report, translator, '/logs/spot-logs.ndjson'))
			.toContain('SPOT wrote which tasks and which fields to its log file, /logs/spot-logs.ndjson.');
	});

	// Logging that could not open its file would send the user to a file that is not there
	test('names no log file when the main process could not name one', () => {
		const message = createTaskStateAuditMessage(auditTaskState([ makeTask() ], []), translator);

		expect(message).toContain('SPOT wrote which tasks and which fields to its log file.');
		expect(message).not.toContain('developer console');
	});

	test('reports a task the task state does not hold', () => {
		const shownTask = makeTask();
		const forgottenTask = makeTask({ text: 'Still stored' });

		const report = auditTaskState([ shownTask ], [ shownTask, forgottenTask ]);

		expect(report.differences).toEqual([{
			taskId: forgottenTask.id,
			taskText: 'Still stored',
			reason: 'missing-in-state'
		}]);
		expect(createTaskStateAuditMessage(report, translator)).toContain('1 task stored but not shown');
	});

	test('reports which fields a task is stored with differently', () => {
		const databaseTask = makeTask({
			text: 'Old',
			priority: 'NORMAL'
		});
		const stateTask = {
			...databaseTask,
			text: 'New',
			priority: 'URGENT' as const
		};

		const report = auditTaskState([ stateTask ], [ databaseTask ]);

		expect(report.differences).toEqual([{
			taskId: stateTask.id,
			taskText: 'New',
			reason: 'different-values',
			fieldNames: [ 'text', 'priority' ]
		}]);
		expect(createTaskStateAuditMessage(report, translator)).toContain('1 task stored with different values');
	});

	test('breaks the message down by reason when every difference is listed', () => {
		const sharedTask = makeTask({ text: 'Old' });
		const changedTask = {
			...sharedTask,
			text: 'New'
		};
		const unstoredTask = makeTask();
		const forgottenTask = makeTask();

		const report = auditTaskState([ changedTask, unstoredTask ], [ sharedTask, forgottenTask ]);

		expect(report.differenceCount).toBe(3);
		expect(createTaskStateAuditMessage(report, translator)).toContain('1 task not stored yet, 1 task stored but not shown, 1 task stored with different values');
	});

	test('caps the listed differences while still counting all of them', () => {
		const unstoredTasks = Array.from({ length: AUDIT_CONFIG.maximumReportedTasks + 5 }, () => {
			return makeTask();
		});

		const report = auditTaskState(unstoredTasks, []);

		expect(report.differenceCount).toBe(AUDIT_CONFIG.maximumReportedTasks + 5);
		expect(report.differences).toHaveLength(AUDIT_CONFIG.maximumReportedTasks);
		expect(createTaskStateAuditMessage(report, translator)).toContain(`${AUDIT_CONFIG.maximumReportedTasks + 5} tasks on screen do not match`);
	});
});
