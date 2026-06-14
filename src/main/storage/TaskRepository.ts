import { openTaskDatabase, runQuery, type SqlQueryLogger, type TaskDatabase } from 'src/main/storage/TaskDatabase';
import { TASK_INSERT_COLUMN_NAMES, TASK_SELECT_COLUMN_NAMES, taskChangeToTaskUpdateColumns, taskRowToColumnValues, taskRowToTask, taskToTaskRow, type TaskRow } from 'src/main/storage/TaskRowMapping';
import type { PersistedTask, PersistedTaskChange, Task } from 'src/types/TaskTypes';

export interface TaskRepositoryOptions {
	storageDirectory: string;
	now?: () => Date;
	sqlLogger?: SqlQueryLogger;
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
	options: TaskRepositoryOptions,
	callback: (taskDatabase: TaskDatabase) => T
): T => {
	const taskDatabase = openTaskDatabase({
		storageDirectory: options.storageDirectory,
		now: options.now,
		sqlLogger: options.sqlLogger
	});

	try {
		return callback(taskDatabase);
	}
	finally {
		taskDatabase.close();
	}
};

export const runTaskTransaction = (taskDatabase: TaskDatabase, callback: () => void): void => {
	runQuery(taskDatabase.sqlLogger, 'BEGIN', () => {
		taskDatabase.connection.exec('BEGIN');
	});

	try {
		callback();
		runQuery(taskDatabase.sqlLogger, 'COMMIT', () => {
			taskDatabase.connection.exec('COMMIT');
		});
	}
	catch(error) {
		runQuery(taskDatabase.sqlLogger, 'ROLLBACK', () => {
			taskDatabase.connection.exec('ROLLBACK');
		});
		throw error;
	}
};

export const readTaskRows = (taskDatabase: TaskDatabase): TaskRow[] => {
	return runQuery(taskDatabase.sqlLogger, SELECT_TASKS_QUERY, () => {
		return taskDatabase.connection.prepare(SELECT_TASKS_QUERY).all() as unknown as TaskRow[];
	});
};

export const readTasks = (options: TaskRepositoryOptions): Task[] => {
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
	const result = runQuery(taskDatabase.sqlLogger, INSERT_TASK_QUERY, () => {
		return taskDatabase.connection.prepare(INSERT_TASK_QUERY).run(
			...taskRowToColumnValues(row, TASK_INSERT_COLUMN_NAMES)
		);
	});

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
	const query = `
		UPDATE tasks
		SET ${assignments}
		WHERE id = ?
	`;
	const result = runQuery(taskDatabase.sqlLogger, query, () => {
		return taskDatabase.connection.prepare(query).run(
			...columns.map((column) => {
				return column.value;
			}),
			taskId
		);
	});

	assertSingleTaskChanged(result.changes, 'update', taskId);
};

export const deleteTaskRecord = (taskDatabase: TaskDatabase, taskId: string): void => {
	const query = `
		DELETE FROM tasks
		WHERE id = ?
	`;
	const result = runQuery(taskDatabase.sqlLogger, query, () => {
		return taskDatabase.connection.prepare(query).run(taskId);
	});

	assertSingleTaskChanged(result.changes, 'delete', taskId);
};
