import { openSpotDatabase, type SpotDatabase } from 'src/main/storage/SpotDatabase';
import { TASK_INSERT_COLUMN_NAMES, TASK_SELECT_COLUMN_NAMES, taskChangeToTaskUpdateColumns, taskRowToColumnValues, taskRowToTask, taskToTaskRow, type TaskRow } from 'src/main/storage/TaskRowMapping';
import type { PersistedTask, PersistedTaskChange, Task } from 'src/types/TaskTypes';

export interface TaskRepositoryOptions {
	storageDirectory: string;
	now?: () => Date;
}

const formatColumnList = (columnNames: readonly string[]): string => {
	return columnNames.join(', ');
};

const createParameterList = (parameterCount: number): string => {
	return Array.from({ length: parameterCount }).map(() => {
		return '?';
	}).join(', ');
};

const SELECT_TASKS_QUERY = `
	SELECT ${formatColumnList(TASK_SELECT_COLUMN_NAMES)}
	FROM tasks
	ORDER BY id ASC
`;

const INSERT_TASK_QUERY = `
	INSERT INTO tasks (${formatColumnList(TASK_INSERT_COLUMN_NAMES)})
	VALUES (${createParameterList(TASK_INSERT_COLUMN_NAMES.length)})
`;

const assertSingleTaskChanged = (changes: number | bigint, action: string, taskId: string): void => {
	if(Number(changes) !== 1) {
		throw new Error(`Cannot ${action} missing task "${taskId}".`);
	}
};

export const withSpotDatabase = <T>(
	options: TaskRepositoryOptions,
	callback: (spotDatabase: SpotDatabase) => T
): T => {
	const spotDatabase = openSpotDatabase({
		storageDirectory: options.storageDirectory,
		now: options.now
	});

	try {
		return callback(spotDatabase);
	}
	finally {
		spotDatabase.close();
	}
};

export const runTaskTransaction = (spotDatabase: SpotDatabase, callback: () => void): void => {
	spotDatabase.runTransaction(callback);
};

export const readTaskRows = (spotDatabase: SpotDatabase): TaskRow[] => {
	return spotDatabase.getAllQueryRows<TaskRow>(SELECT_TASKS_QUERY);
};

export const readTasksFromDatabase = (spotDatabase: SpotDatabase): Task[] => {
	return readTaskRows(spotDatabase).map((taskRow) => {
		return taskRowToTask(taskRow);
	});
};

export const readTasks = (options: TaskRepositoryOptions): Task[] => {
	return withSpotDatabase(options, (spotDatabase) => {
		return readTasksFromDatabase(spotDatabase);
	});
};

export const insertTaskRecord = (spotDatabase: SpotDatabase, task: PersistedTask, writtenAt: Date): void => {
	const row = taskToTaskRow(task, {
		createdAt: writtenAt,
		updatedAt: writtenAt
	});
	const result = spotDatabase.runQuery(INSERT_TASK_QUERY, ...taskRowToColumnValues(row, TASK_INSERT_COLUMN_NAMES));

	assertSingleTaskChanged(result.changes, 'create', task.id);
};

export const updateTaskRecord = (
	spotDatabase: SpotDatabase,
	taskId: string,
	change: PersistedTaskChange,
	writtenAt: Date
): void => {
	const columns = taskChangeToTaskUpdateColumns(change, writtenAt);
	const assignments = columns.map((column) => {
		return `${column.columnName} = ?`;
	}).join(', ');
	const query = `
		UPDATE tasks
		SET ${assignments}
		WHERE id = ?
	`;
	const result = spotDatabase.runQuery(query, ...columns.map((column) => {
		return column.value;
	}), taskId);

	assertSingleTaskChanged(result.changes, 'update', taskId);
};

export const deleteTaskRecord = (spotDatabase: SpotDatabase, taskId: string): void => {
	const query = `
		DELETE FROM tasks
		WHERE id = ?
	`;
	const result = spotDatabase.runQuery(query, taskId);

	assertSingleTaskChanged(result.changes, 'delete', taskId);
};
