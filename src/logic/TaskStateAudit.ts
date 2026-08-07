import { AUDIT_CONFIG } from 'src/config/AppConfig';
import { getDifferingPersistedTaskFieldNames } from 'src/logic/TaskComparison';
import type { SpotTranslationKey, SpotTranslator } from 'src/i18n/Translations';
import type { TaskStateAuditDifference, TaskStateAuditReason, TaskStateAuditReport } from 'src/types/TaskAuditTypes';
import type { Task } from 'src/types/TaskTypes';

// The report travels to the main process, which writes it to the operational log, so its shape is owned by "src/types" and re-exported here
export type { TaskStateAuditDifference, TaskStateAuditReason, TaskStateAuditReport } from 'src/types/TaskAuditTypes';

const createTaskMap = (tasks: Task[]): Map<string, Task> => {
	return new Map(tasks.map((task) => {
		return [ task.id, task ];
	}));
};

/**
 * Compares the tasks React holds against the tasks the database holds.
 * The caller is responsible for only auditing tasks that have nothing left to write: a task state that is still ahead of the
 * database is the optimistic write path working as designed, not a drift.
 * @param stateTasks Tasks as the task state holds them, active and completed together.
 * @param databaseTasks Tasks as they were read back from the database.
 * @returns What the two disagree on.
 */
export const auditTaskState = (stateTasks: Task[], databaseTasks: Task[]): TaskStateAuditReport => {
	const databaseTasksById = createTaskMap(databaseTasks);
	const stateTaskIds = new Set(stateTasks.map((task) => {
		return task.id;
	}));
	const differences: TaskStateAuditDifference[] = [];

	stateTasks.forEach((stateTask) => {
		const databaseTask = databaseTasksById.get(stateTask.id);

		if(!databaseTask) {
			differences.push({
				taskId: stateTask.id,
				taskText: stateTask.text,
				reason: 'missing-in-database'
			});

			return;
		}

		const fieldNames = getDifferingPersistedTaskFieldNames(databaseTask, stateTask);

		if(fieldNames.length > 0) {
			differences.push({
				taskId: stateTask.id,
				taskText: stateTask.text,
				reason: 'different-values',
				fieldNames
			});
		}
	});

	// A task the database holds and the task state does not comes back on the next launch, so it is a drift the user has to know about too
	databaseTasks.forEach((databaseTask) => {
		if(!stateTaskIds.has(databaseTask.id)) {
			differences.push({
				taskId: databaseTask.id,
				taskText: databaseTask.text,
				reason: 'missing-in-state'
			});
		}
	});

	return {
		isAligned: differences.length === 0,
		stateTaskCount: stateTasks.length,
		databaseTaskCount: databaseTasks.length,
		differenceCount: differences.length,
		differences: differences.slice(0, AUDIT_CONFIG.maximumReportedTasks)
	};
};

// Each reason is its own sentence fragment rather than a count followed by a description, because how a language counts
// and how it words the reason cannot be assumed to compose the same way English does
const AUDIT_REASON_KEYS: readonly { reason: TaskStateAuditReason; key: SpotTranslationKey }[] = [
	{ reason: 'missing-in-database', key: 'audit.details.missingInDatabase' },
	{ reason: 'missing-in-state', key: 'audit.details.missingInState' },
	{ reason: 'different-values', key: 'audit.details.differentValues' }
];

const countDifferencesByReason = (report: TaskStateAuditReport, reason: TaskStateAuditReason): number => {
	return report.differences.filter((difference) => {
		return difference.reason === reason;
	}).length;
};

/**
 * Describes an audit report for the user.
 * The wording stays a notice: the audit only reads, so what it found is never a reason to distrust what is on screen.
 * @param report Report to describe.
 * @param translator Translator for the current language.
 * @param logFilePath Operational log file the report was written to, when the main process could name one.
 * @returns The message, or undefined when the report found nothing.
 */
export const createTaskStateAuditMessage = (report: TaskStateAuditReport, translator: SpotTranslator, logFilePath?: string): string | undefined => {
	if(report.isAligned) {
		return undefined;
	}

	// The message only says how much drifted, so it has to say where the tasks and the fields behind it can be read
	const trailer = translator.t('audit.trailer', {
		logLocation: logFilePath ? translator.t('audit.logLocation', { logFilePath }) : translator.t('audit.unknownLogLocation')
	});

	// The counts come from the capped list, so the report is only broken down by reason when the whole of it fits in that list
	if(report.differenceCount > report.differences.length) {
		return translator.t('audit.report', {
			details: translator.t('audit.cappedDetails', { count: report.differenceCount }),
			trailer
		});
	}

	const details = AUDIT_REASON_KEYS.flatMap(({ reason, key }) => {
		const count = countDifferencesByReason(report, reason);

		return count > 0 ? [ translator.t(key, { count }) ] : [];
	});

	return translator.t('audit.report', {
		details: translator.formatList(details),
		trailer
	});
};
