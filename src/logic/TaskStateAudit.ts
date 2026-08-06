import { AUDIT_CONFIG } from 'src/config/AppConfig';
import { getDifferingPersistedTaskFieldNames } from 'src/logic/TaskComparison';
import type { SpotTranslationKey, SpotTranslator } from 'src/i18n/Translations';
import type { Task } from 'src/types/TaskTypes';

/**
 * Why one task is not aligned.
 * "missing-in-database" is the one that loses data on the next launch, so it is reported first.
 */
export type TaskStateAuditReason = 'missing-in-database' | 'missing-in-state' | 'different-values';

export interface TaskStateAuditDifference {
	taskId: string;
	taskText: string;
	reason: TaskStateAuditReason;

	// Only set for "different-values": the persisted fields the two tasks disagree on
	fieldNames?: string[];
}

export interface TaskStateAuditReport {
	isAligned: boolean;
	stateTaskCount: number;
	databaseTaskCount: number;
	differenceCount: number;

	// Capped at AUDIT_CONFIG.maximumReportedTasks, while differenceCount stays the real total
	differences: TaskStateAuditDifference[];
}

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
 * @returns The message, or undefined when the report found nothing.
 */
export const createTaskStateAuditMessage = (report: TaskStateAuditReport, translator: SpotTranslator): string | undefined => {
	if(report.isAligned) {
		return undefined;
	}

	const trailer = translator.t('audit.trailer');

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
