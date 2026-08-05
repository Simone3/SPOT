import { createInvalidChangeError } from 'src/framework/main/storage/InvalidChangeError';
import type { PersistedTask, PersistedTaskChange, Task, TaskPriorityValue, TaskStatus } from 'src/types/TaskTypes';

export interface TaskRow {
	id: string;
	text: string;
	state: string;
	priority: string;
	owner: string | null;
	due_date: string | null;
	tags_json: string;
	sort_position: number;
	completion_date: string | null;
	created_at: string;
	updated_at: string;
}

interface TaskRowTimestamps {
	createdAt: Date;
	updatedAt: Date;
}

export type TaskRowColumnName = keyof TaskRow;

export type TaskColumnValue = string | number | null;

export interface TaskUpdateColumn {
	columnName: TaskRowColumnName;
	value: TaskColumnValue;
}

type PersistedTaskFieldName = keyof PersistedTask;

type TaskDataColumnName = Exclude<TaskRowColumnName, 'created_at' | 'updated_at'>;

interface TaskFieldColumnMapping<TField extends PersistedTaskFieldName> {
	taskField: TField;
	columnName: TaskDataColumnName;
	mutable: boolean;
	required: boolean;
	toColumnValue: (value: PersistedTask[TField]) => TaskColumnValue;
	fromRow: (row: TaskRow) => PersistedTask[TField];
}

interface AnyTaskFieldColumnMapping {
	taskField: PersistedTaskFieldName;
	columnName: TaskDataColumnName;
	mutable: boolean;
	required: boolean;
	toColumnValue: (value: PersistedTask[PersistedTaskFieldName]) => TaskColumnValue;
	fromRow: (row: TaskRow) => PersistedTask[PersistedTaskFieldName];
}

const TASK_STATUSES = new Set<TaskStatus>([ 'ACTIVE', 'COMPLETED' ]);

const TASK_PRIORITIES = new Set<TaskPriorityValue>([ 'URGENT', 'HIGH', 'NORMAL', 'LOW' ]);

const isTaskStatus = (value: string): value is TaskStatus => {
	return TASK_STATUSES.has(value as TaskStatus);
};

const isTaskPriority = (value: string): value is TaskPriorityValue => {
	return TASK_PRIORITIES.has(value as TaskPriorityValue);
};

const parseTags = (tagsJson: string): string[] => {
	const parsedTags: unknown = JSON.parse(tagsJson);

	if(!Array.isArray(parsedTags)) {
		throw new Error('Task row tags_json must contain a JSON array of strings.');
	}

	const tags = parsedTags.filter((tag): tag is string => {
		return typeof tag === 'string';
	});

	if(tags.length !== parsedTags.length) {
		throw new Error('Task row tags_json must contain a JSON array of strings.');
	}

	return tags;
};

const createTaskFieldColumnMapping = <TField extends PersistedTaskFieldName>(
	mapping: TaskFieldColumnMapping<TField>
): AnyTaskFieldColumnMapping => {
	return mapping as unknown as AnyTaskFieldColumnMapping;
};

export const createImmutableTaskFieldChangeMessage = (taskField: string, columnName: string): string => {
	return `Task field "${taskField}" maps to immutable column "${columnName}" and cannot be changed.`;
};

export const createMissingRequiredTaskFieldMessage = (taskField: string): string => {
	return `Task change field "${taskField}" cannot be undefined.`;
};

const getTaskStatusFromRow = (row: TaskRow): TaskStatus => {
	if(!isTaskStatus(row.state)) {
		throw new Error(`Unsupported task state "${row.state}".`);
	}

	return row.state;
};

const getTaskPriorityFromRow = (row: TaskRow): TaskPriorityValue => {
	if(!isTaskPriority(row.priority)) {
		throw new Error(`Unsupported task priority "${row.priority}".`);
	}

	return row.priority;
};

export const TASK_FIELD_COLUMN_MAPPINGS: readonly AnyTaskFieldColumnMapping[] = [
	createTaskFieldColumnMapping({
		taskField: 'id',
		columnName: 'id',
		mutable: false,
		required: true,
		toColumnValue: (value) => {
			return value;
		},
		fromRow: (row) => {
			return row.id;
		}
	}),
	createTaskFieldColumnMapping({
		taskField: 'text',
		columnName: 'text',
		mutable: true,
		required: true,
		toColumnValue: (value) => {
			return value;
		},
		fromRow: (row) => {
			return row.text;
		}
	}),
	createTaskFieldColumnMapping({
		taskField: 'state',
		columnName: 'state',
		mutable: true,
		required: true,
		toColumnValue: (value) => {
			return value;
		},
		fromRow: getTaskStatusFromRow
	}),
	createTaskFieldColumnMapping({
		taskField: 'priority',
		columnName: 'priority',
		mutable: true,
		required: true,
		toColumnValue: (value) => {
			return value;
		},
		fromRow: getTaskPriorityFromRow
	}),
	createTaskFieldColumnMapping({
		taskField: 'owner',
		columnName: 'owner',
		mutable: true,
		required: false,
		toColumnValue: (value) => {
			return value || null;
		},
		fromRow: (row) => {
			return row.owner || undefined;
		}
	}),
	createTaskFieldColumnMapping({
		taskField: 'dueDate',
		columnName: 'due_date',
		mutable: true,
		required: false,
		toColumnValue: (value) => {
			return value || null;
		},
		fromRow: (row) => {
			return row.due_date || undefined;
		}
	}),
	createTaskFieldColumnMapping({
		taskField: 'tags',
		columnName: 'tags_json',
		mutable: true,
		required: true,
		toColumnValue: (value) => {
			return JSON.stringify(value);
		},
		fromRow: (row) => {
			return parseTags(row.tags_json);
		}
	}),
	createTaskFieldColumnMapping({
		taskField: 'sortPosition',
		columnName: 'sort_position',
		mutable: true,
		required: true,
		toColumnValue: (value) => {
			return value;
		},
		fromRow: (row) => {
			return row.sort_position;
		}
	}),
	createTaskFieldColumnMapping({
		taskField: 'completionDate',
		columnName: 'completion_date',
		mutable: true,
		required: false,
		toColumnValue: (value) => {
			return value ? value.toISOString() : null;
		},
		fromRow: (row) => {
			return row.completion_date ? new Date(row.completion_date) : undefined;
		}
	})
];

const TASK_ROW_TIMESTAMP_COLUMN_NAMES: readonly TaskRowColumnName[] = [ 'created_at', 'updated_at' ];

export const TASK_ROW_COLUMN_NAMES: readonly TaskRowColumnName[] = [
	...TASK_FIELD_COLUMN_MAPPINGS.map((mapping) => {
		return mapping.columnName;
	}),
	...TASK_ROW_TIMESTAMP_COLUMN_NAMES
];

export const TASK_SELECT_COLUMN_NAMES = TASK_ROW_COLUMN_NAMES;

export const TASK_INSERT_COLUMN_NAMES = TASK_ROW_COLUMN_NAMES;

const taskFieldValueToColumnValue = (
	mapping: AnyTaskFieldColumnMapping,
	task: PersistedTask
): TaskColumnValue => {
	return mapping.toColumnValue(task[mapping.taskField]);
};

const setTaskRowValue = (
	row: Partial<Record<TaskRowColumnName, TaskColumnValue>>,
	columnName: TaskRowColumnName,
	value: TaskColumnValue
): void => {
	row[columnName] = value;
};

export const taskToTaskRow = (task: PersistedTask, timestamps: TaskRowTimestamps): TaskRow => {
	const row: Partial<Record<TaskRowColumnName, TaskColumnValue>> = {};

	TASK_FIELD_COLUMN_MAPPINGS.forEach((mapping) => {
		setTaskRowValue(row, mapping.columnName, taskFieldValueToColumnValue(mapping, task));
	});
	setTaskRowValue(row, 'created_at', timestamps.createdAt.toISOString());
	setTaskRowValue(row, 'updated_at', timestamps.updatedAt.toISOString());

	return row as unknown as TaskRow;
};

const setTaskFieldValue = (
	task: Partial<PersistedTask>,
	mapping: AnyTaskFieldColumnMapping,
	value: PersistedTask[PersistedTaskFieldName]
): void => {
	(task as Partial<Record<PersistedTaskFieldName, PersistedTask[PersistedTaskFieldName]>>)[mapping.taskField] = value;
};

export const taskRowToTask = (row: TaskRow): Task => {
	const task: Partial<PersistedTask> = {};

	return {
		...TASK_FIELD_COLUMN_MAPPINGS.reduce((mappedTask, mapping) => {
			setTaskFieldValue(mappedTask, mapping, mapping.fromRow(row));
			return mappedTask;
		}, task) as PersistedTask,
		visible: false
	};
};

export const taskRowToColumnValues = (
	row: TaskRow,
	columnNames: readonly TaskRowColumnName[]
): TaskColumnValue[] => {
	return columnNames.map((columnName) => {
		return row[columnName];
	});
};

const hasTaskChange = (change: PersistedTaskChange, taskField: PersistedTaskFieldName): boolean => {
	return Object.prototype.hasOwnProperty.call(change, taskField);
};

const getTaskChangeFieldValue = (
	change: PersistedTaskChange,
	mapping: AnyTaskFieldColumnMapping
): PersistedTask[PersistedTaskFieldName] => {
	const value = (change as Partial<PersistedTask>)[mapping.taskField];

	// The same change would always be refused in the same way, so it must not look like a database failure the queue can retry
	if(value === undefined && mapping.required) {
		throw createInvalidChangeError(createMissingRequiredTaskFieldMessage(mapping.taskField));
	}

	return value;
};

const taskChangeFieldToColumnValue = (
	change: PersistedTaskChange,
	mapping: AnyTaskFieldColumnMapping
): TaskColumnValue => {
	return mapping.toColumnValue(getTaskChangeFieldValue(change, mapping));
};

export const taskChangeToTaskUpdateColumns = (
	change: PersistedTaskChange,
	updatedAt: Date
): TaskUpdateColumn[] => {
	const columns: TaskUpdateColumn[] = [];

	TASK_FIELD_COLUMN_MAPPINGS.forEach((mapping) => {
		if(!hasTaskChange(change, mapping.taskField)) {
			return;
		}

		if(!mapping.mutable) {
			throw createInvalidChangeError(createImmutableTaskFieldChangeMessage(mapping.taskField, mapping.columnName));
		}

		columns.push({
			columnName: mapping.columnName,
			value: taskChangeFieldToColumnValue(change, mapping)
		});
	});
	columns.push({
		columnName: 'updated_at',
		value: updatedAt.toISOString()
	});

	return columns;
};
