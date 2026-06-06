import type { PersistedTask } from 'src/main/storage/TaskStorage';
import type { Task, TaskPriorityValue, TaskStatus } from 'src/types/TaskTypes';

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

export const taskToTaskRow = (task: PersistedTask, timestamps: TaskRowTimestamps): TaskRow => {
	return {
		id: task.id,
		text: task.text,
		state: task.state,
		priority: task.priority,
		owner: task.owner || null,
		due_date: task.dueDate || null,
		tags_json: JSON.stringify(task.tags),
		sort_position: task.sortPosition,
		completion_date: task.completionDate ? task.completionDate.toISOString() : null,
		created_at: timestamps.createdAt.toISOString(),
		updated_at: timestamps.updatedAt.toISOString()
	};
};

export const taskRowToTask = (row: TaskRow): Task => {
	if(!isTaskStatus(row.state)) {
		throw new Error(`Unsupported task state "${row.state}".`);
	}

	if(!isTaskPriority(row.priority)) {
		throw new Error(`Unsupported task priority "${row.priority}".`);
	}

	return {
		id: row.id,
		text: row.text,
		state: row.state,
		priority: row.priority,
		owner: row.owner || undefined,
		dueDate: row.due_date || undefined,
		tags: parseTags(row.tags_json),
		sortPosition: row.sort_position,
		visible: false,
		completionDate: row.completion_date ? new Date(row.completion_date) : undefined
	};
};
