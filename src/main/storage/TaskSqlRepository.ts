import { openTaskDatabase, type TaskDatabase } from 'src/main/storage/TaskDatabase';
import { TASK_INSERT_COLUMN_NAMES, TASK_SELECT_COLUMN_NAMES, taskChangeToTaskUpdateColumns, taskRowToColumnValues, taskRowToTask, taskToTaskRow, type TaskRow } from 'src/main/storage/TaskRowMapping';
import type { PersistedTask, PersistedTaskChange } from 'src/main/storage/TaskStorage';
import type { Task } from 'src/types/TaskTypes';

export interface TaskSqlRepositoryOptions {
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

export const withTaskDatabase = <T>(
	options: TaskSqlRepositoryOptions,
	callback: (taskDatabase: TaskDatabase) => T
): T => {
	const taskDatabase = openTaskDatabase({
		storageDirectory: options.storageDirectory,
		now: options.now
	});

	try {
		return callback(taskDatabase);
	}
	finally {
		taskDatabase.close();
	}
};

export const runTaskTransaction = (taskDatabase: TaskDatabase, callback: () => void): void => {
	taskDatabase.connection.exec('BEGIN');

	try {
		callback();
		taskDatabase.connection.exec('COMMIT');
	}
	catch(error) {
		taskDatabase.connection.exec('ROLLBACK');
		throw error;
	}
};

export const readTaskRows = (taskDatabase: TaskDatabase): TaskRow[] => {
	return taskDatabase.connection.prepare(SELECT_TASKS_QUERY).all() as unknown as TaskRow[];
};

export const readTasks = (options: TaskSqlRepositoryOptions): Task[] => {
	return withTaskDatabase(options, (taskDatabase) => {
		return readTaskRows(taskDatabase).map((taskRow) => {
			return taskRowToTask(taskRow);
		});
	});
};

export const insertTaskRecord = (taskDatabase: TaskDatabase, task: PersistedTask, writtenAt: Date): void => {
	const row = taskToTaskRow(task, {
		createdAt: writtenAt,
		updatedAt: writtenAt
	});
	const result = taskDatabase.connection.prepare(INSERT_TASK_QUERY).run(
		...taskRowToColumnValues(row, TASK_INSERT_COLUMN_NAMES)
	);

	assertSingleTaskChanged(result.changes, 'create', task.id);
};

export const updateTaskRecord = (
	taskDatabase: TaskDatabase,
	taskId: string,
	change: PersistedTaskChange,
	writtenAt: Date
): void => {
	const columns = taskChangeToTaskUpdateColumns(change, writtenAt);
	const assignments = columns.map((column) => {
		return `${column.columnName} = ?`;
	}).join(', ');
	const result = taskDatabase.connection.prepare(`
		UPDATE tasks
		SET ${assignments}
		WHERE id = ?
	`).run(
		...columns.map((column) => {
			return column.value;
		}),
		taskId
	);

	assertSingleTaskChanged(result.changes, 'update', taskId);
};

export const deleteTaskRecord = (taskDatabase: TaskDatabase, taskId: string): void => {
	const result = taskDatabase.connection.prepare(`
		DELETE FROM tasks
		WHERE id = ?
	`).run(taskId);

	assertSingleTaskChanged(result.changes, 'delete', taskId);
};
