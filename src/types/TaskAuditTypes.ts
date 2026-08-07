/**
 * What the audit of the task state against the database found.
 * The renderer produces a report and the main process writes it to the operational log, so the shape is shared by both sides.
 */

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
