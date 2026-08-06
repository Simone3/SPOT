import type { PersistedTask, PersistedTaskChange, Task } from 'src/types/TaskTypes';

/**
 * The task fields the database holds, and the only ones two tasks are ever compared on.
 * "id" is not one of them: it identifies the task instead of describing it, and the storage layer refuses a change to it.
 */
export const PERSISTED_TASK_FIELD_NAMES: readonly (keyof PersistedTaskChange)[] = [
	'text',
	'state',
	'priority',
	'owner',
	'dueDate',
	'tags',
	'sortPosition',
	'completionDate'
];

type PersistedTaskValue = PersistedTask[keyof PersistedTask];

const cloneDate = (date: Date | undefined): Date | undefined => {
	return date ? new Date(date) : undefined;
};

// An optional field the user emptied is stored as NULL and read back as undefined, so an empty string is normalized here too:
// otherwise the same task would compare as different depending on whether it came from the database or from the renderer,
// and clearing such a field would send a change the database is already holding
const normalizeOptionalText = (value: string | undefined): string | undefined => {
	return value || undefined;
};

/**
 * Reduces a task to the values the database holds, normalized the way the database holds them.
 * This is the only definition of what a stored task is: it decides what a write sends and what an audit compares.
 * @param task Task to reduce.
 * @returns The persisted part of the task.
 */
export const taskToPersistedTask = (task: Task): PersistedTask => {
	return {
		id: task.id,
		text: task.text,
		state: task.state,
		priority: task.priority,
		owner: normalizeOptionalText(task.owner),
		dueDate: normalizeOptionalText(task.dueDate),

		// An empty tag is a tag input the user has not filled in yet, or one they just emptied: it is never persisted, and stripping
		// it on both sides of the comparison also keeps it from ever looking like a change
		tags: task.tags.filter((tag) => {
			return tag;
		}),
		sortPosition: task.sortPosition,
		completionDate: cloneDate(task.completionDate)
	};
};

const getPersistedTaskValue = (task: Task, fieldName: keyof PersistedTask): PersistedTaskValue => {
	return taskToPersistedTask(task)[fieldName];
};

/**
 * Compares two values of the same persisted task field.
 * @param previousValue Value to compare.
 * @param nextValue Value to compare it against.
 * @returns Whether the two values would be stored identically.
 */
export const arePersistedTaskValuesEqual = (previousValue: PersistedTaskValue, nextValue: PersistedTaskValue): boolean => {
	if(previousValue instanceof Date || nextValue instanceof Date) {
		return previousValue instanceof Date &&
			nextValue instanceof Date &&
			previousValue.getTime() === nextValue.getTime();
	}

	if(Array.isArray(previousValue) || Array.isArray(nextValue)) {
		return Array.isArray(previousValue) &&
			Array.isArray(nextValue) &&
			previousValue.length === nextValue.length &&
			previousValue.every((value, index) => {
				return value === nextValue[index];
			});
	}

	return previousValue === nextValue;
};

const setPersistedTaskChangeValue = (
	change: PersistedTaskChange,
	fieldName: keyof PersistedTaskChange,
	value: PersistedTaskValue
): void => {
	(change as Partial<Record<keyof PersistedTaskChange, PersistedTaskValue>>)[fieldName] = value;
};

/**
 * Builds the change that turns one task into another, holding only the fields whose stored value differs.
 * A field cleared by the user is present and undefined, which is what stores it as NULL.
 * @param previousTask Task as it is stored.
 * @param nextTask Task as it should be stored.
 * @returns The change, empty when the two tasks would be stored identically.
 */
export const createPersistedTaskChange = (previousTask: Task, nextTask: Task): PersistedTaskChange => {
	const change: PersistedTaskChange = {};

	PERSISTED_TASK_FIELD_NAMES.forEach((fieldName) => {
		const previousValue = getPersistedTaskValue(previousTask, fieldName);
		const nextValue = getPersistedTaskValue(nextTask, fieldName);

		if(!arePersistedTaskValuesEqual(previousValue, nextValue)) {
			setPersistedTaskChangeValue(change, fieldName, nextValue);
		}
	});

	return change;
};

/**
 * Tells whether a change holds anything to store.
 * @param change Change to inspect.
 * @returns Whether the change would update at least one field.
 */
export const hasPersistedTaskChange = (change: PersistedTaskChange): boolean => {
	return Object.keys(change).length > 0;
};

/**
 * Lists the persisted fields two tasks disagree on.
 * @param previousTask Task to compare.
 * @param nextTask Task to compare it against.
 * @returns The differing field names, empty when the two tasks would be stored identically.
 */
export const getDifferingPersistedTaskFieldNames = (previousTask: Task, nextTask: Task): string[] => {
	return Object.keys(createPersistedTaskChange(previousTask, nextTask));
};
