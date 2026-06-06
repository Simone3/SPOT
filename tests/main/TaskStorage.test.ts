import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DATABASE_FILE_NAME, openTaskDatabase } from 'src/main/storage/TaskDatabase';
import { TASK_INSERT_COLUMN_NAMES, TASK_SELECT_COLUMN_NAMES, createImmutableTaskFieldChangeMessage, taskRowToColumnValues, taskToTaskRow, type TaskRow } from 'src/main/storage/TaskRowMapping';
import { createTaskStorage, OPERATIONAL_LOG_FILE_NAME, OPERATIONAL_LOG_NOT_IMPLEMENTED_MESSAGE, STORAGE_NOT_IMPLEMENTED_MESSAGE, type OperationalLogEntry, type PersistedTask, type TaskStorageCommand } from 'src/main/storage/TaskStorage';

const makeTempStorageDirectory = (): string => {
	return mkdtempSync(path.join(tmpdir(), 'spot-storage-'));
};

const formatColumnList = (columnNames: readonly string[]): string => {
	return columnNames.map((columnName) => {
		return `\t\t\t\t${columnName}`;
	}).join(',\n');
};

const createParameterList = (parameterCount: number): string => {
	return Array.from({ length: parameterCount }).map(() => {
		return '?';
	}).join(', ');
};

const insertPersistedTask = (storageDirectory: string, task: PersistedTask): void => {
	const taskDatabase = openTaskDatabase({
		storageDirectory,
		now: () => {
			return new Date('2026-06-06T09:00:00.000Z');
		}
	});
	const row = taskToTaskRow(task, {
		createdAt: new Date('2026-06-06T10:00:00.000Z'),
		updatedAt: new Date('2026-06-06T11:00:00.000Z')
	});

	try {
		taskDatabase.connection.prepare(`
			INSERT INTO tasks (
${formatColumnList(TASK_INSERT_COLUMN_NAMES)}
			)
			VALUES (${createParameterList(TASK_INSERT_COLUMN_NAMES.length)})
		`).run(
			...taskRowToColumnValues(row, TASK_INSERT_COLUMN_NAMES)
		);
	}
	finally {
		taskDatabase.close();
	}
};

const readPersistedTaskRows = (storageDirectory: string): TaskRow[] => {
	const taskDatabase = openTaskDatabase({
		storageDirectory,
		now: () => {
			return new Date('2026-06-06T09:00:00.000Z');
		}
	});

	try {
		return taskDatabase.connection.prepare(`
			SELECT
${formatColumnList(TASK_SELECT_COLUMN_NAMES)}
			FROM tasks
			ORDER BY id ASC
		`).all() as unknown as TaskRow[];
	}
	finally {
		taskDatabase.close();
	}
};

describe('TaskStorage', () => {
	const tempStorageDirectories: string[] = [];

	afterEach(() => {
		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('reports the unwired database and operational log status', async() => {
		const taskStorage = createTaskStorage();

		const status = await taskStorage.getStorageStatus();

		expect(status).toEqual({
			database: {
				state: 'not-configured',
				message: STORAGE_NOT_IMPLEMENTED_MESSAGE
			},
			operationalLog: {
				state: 'not-configured',
				message: STORAGE_NOT_IMPLEMENTED_MESSAGE
			}
		});
	});

	test('returns explicit placeholder failures while storage is unwired', async() => {
		const taskStorage = createTaskStorage();
		const command: TaskStorageCommand = {
			command: 'task.update',
			payload: {
				taskId: 'task-1',
				change: {
					text: 'Updated task'
				}
			}
		};
		const logEntry: OperationalLogEntry = {
			createdAt: '2026-06-06T12:00:00.000Z',
			type: 'react.command',
			command: command.command,
			payload: command.payload
		};

		await expect(taskStorage.loadTasks()).resolves.toMatchObject({
			ok: false,
			reason: 'not-implemented',
			message: STORAGE_NOT_IMPLEMENTED_MESSAGE
		});
		await expect(taskStorage.executeTaskCommand(command)).resolves.toMatchObject({
			ok: false,
			reason: 'not-implemented',
			message: STORAGE_NOT_IMPLEMENTED_MESSAGE
		});
		await expect(taskStorage.writeOperationalLogLine(logEntry)).resolves.toMatchObject({
			ok: false,
			reason: 'not-implemented',
			message: STORAGE_NOT_IMPLEMENTED_MESSAGE
		});
	});

	test('loads an empty task list from a configured SQLite database', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const taskStorage = createTaskStorage({ storageDirectory });

		const result = await taskStorage.loadTasks();

		expect(result).toMatchObject({
			ok: true,
			tasks: [],
			status: {
				database: {
					state: 'healthy'
				},
				operationalLog: {
					state: 'not-configured'
				},
				storageDirectory,
				databasePath: path.join(storageDirectory, DATABASE_FILE_NAME),
				operationalLogPath: path.join(storageDirectory, OPERATIONAL_LOG_FILE_NAME)
			}
		});
		expect(existsSync(path.join(storageDirectory, DATABASE_FILE_NAME))).toBe(true);
	});

	test('reports configured storage status', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const taskStorage = createTaskStorage({ storageDirectory });

		const status = await taskStorage.getStorageStatus();

		expect(status).toEqual({
			database: {
				state: 'healthy'
			},
			operationalLog: {
				state: 'not-configured',
				message: OPERATIONAL_LOG_NOT_IMPLEMENTED_MESSAGE
			},
			storageDirectory,
			databasePath: path.join(storageDirectory, DATABASE_FILE_NAME),
			operationalLogPath: path.join(storageDirectory, OPERATIONAL_LOG_FILE_NAME)
		});
		expect(existsSync(path.join(storageDirectory, DATABASE_FILE_NAME))).toBe(true);
	});

	test('loads stored task rows from SQLite', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const completedAt = new Date('2026-06-06T12:00:00.000Z');
		const activeTask: PersistedTask = {
			id: 'active-task',
			text: 'Read active task',
			state: 'ACTIVE',
			priority: 'URGENT',
			owner: undefined,
			dueDate: '2026-06-10',
			tags: [ 'storage' ],
			sortPosition: 100,
			completionDate: undefined
		};
		const completedTask: PersistedTask = {
			id: 'completed-task',
			text: 'Read completed task',
			state: 'COMPLETED',
			priority: 'LOW',
			owner: 'Simone',
			dueDate: undefined,
			tags: [ 'done', 'sqlite' ],
			sortPosition: 200,
			completionDate: completedAt
		};
		insertPersistedTask(storageDirectory, completedTask);
		insertPersistedTask(storageDirectory, activeTask);
		const taskStorage = createTaskStorage({ storageDirectory });

		const result = await taskStorage.loadTasks();

		expect(result).toEqual({
			ok: true,
			tasks: [
				{
					...activeTask,
					visible: false
				},
				{
					...completedTask,
					visible: false
				}
			],
			status: {
				database: {
					state: 'healthy'
				},
				operationalLog: {
					state: 'not-configured',
					message: OPERATIONAL_LOG_NOT_IMPLEMENTED_MESSAGE
				},
				storageDirectory,
				databasePath: path.join(storageDirectory, DATABASE_FILE_NAME),
				operationalLogPath: path.join(storageDirectory, OPERATIONAL_LOG_FILE_NAME)
			}
		});
	});

	test('executes task create, update, and delete commands against SQLite', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const updatedAt = new Date('2026-06-06T13:00:00.000Z');
		const completionDate = new Date('2026-06-06T14:00:00.000Z');
		const restoredAt = new Date('2026-06-06T15:00:00.000Z');
		const createdTask: PersistedTask = {
			id: 'created-task',
			text: 'Create persisted task',
			state: 'ACTIVE',
			priority: 'HIGH',
			owner: 'Simone',
			dueDate: '2026-06-10',
			tags: [ 'storage' ],
			sortPosition: 100,
			completionDate: undefined
		};
		const createTaskStorageInstance = createTaskStorage({
			storageDirectory,
			now: () => {
				return createdAt;
			}
		});

		await expect(createTaskStorageInstance.executeTaskCommand({
			command: 'task.create',
			payload: {
				task: createdTask
			}
		})).resolves.toMatchObject({
			ok: true,
			status: {
				database: {
					state: 'healthy'
				},
				operationalLog: {
					state: 'not-configured'
				}
			}
		});

		expect(readPersistedTaskRows(storageDirectory)).toEqual([
			{
				id: 'created-task',
				text: 'Create persisted task',
				state: 'ACTIVE',
				priority: 'HIGH',
				owner: 'Simone',
				due_date: '2026-06-10',
				tags_json: '["storage"]',
				sort_position: 100,
				completion_date: null,
				created_at: createdAt.toISOString(),
				updated_at: createdAt.toISOString()
			}
		]);

		const updateTaskStorageInstance = createTaskStorage({
			storageDirectory,
			now: () => {
				return updatedAt;
			}
		});
		await expect(updateTaskStorageInstance.executeTaskCommand({
			command: 'task.update',
			payload: {
				taskId: 'created-task',
				change: {
					text: 'Updated persisted task',
					state: 'COMPLETED',
					priority: 'LOW',
					owner: undefined,
					dueDate: undefined,
					tags: [ 'storage', 'updated' ],
					sortPosition: 200,
					completionDate
				}
			}
		})).resolves.toMatchObject({
			ok: true
		});

		expect(readPersistedTaskRows(storageDirectory)).toEqual([
			{
				id: 'created-task',
				text: 'Updated persisted task',
				state: 'COMPLETED',
				priority: 'LOW',
				owner: null,
				due_date: null,
				tags_json: '["storage","updated"]',
				sort_position: 200,
				completion_date: completionDate.toISOString(),
				created_at: createdAt.toISOString(),
				updated_at: updatedAt.toISOString()
			}
		]);

		await expect(updateTaskStorageInstance.loadTasks()).resolves.toEqual({
			ok: true,
			tasks: [
				{
					id: 'created-task',
					text: 'Updated persisted task',
					state: 'COMPLETED',
					priority: 'LOW',
					owner: undefined,
					dueDate: undefined,
					tags: [ 'storage', 'updated' ],
					sortPosition: 200,
					visible: false,
					completionDate
				}
			],
			status: {
				database: {
					state: 'healthy'
				},
				operationalLog: {
					state: 'not-configured',
					message: OPERATIONAL_LOG_NOT_IMPLEMENTED_MESSAGE
				},
				storageDirectory,
				databasePath: path.join(storageDirectory, DATABASE_FILE_NAME),
				operationalLogPath: path.join(storageDirectory, OPERATIONAL_LOG_FILE_NAME)
			}
		});

		const restoreTaskStorageInstance = createTaskStorage({
			storageDirectory,
			now: () => {
				return restoredAt;
			}
		});
		await expect(restoreTaskStorageInstance.executeTaskCommand({
			command: 'task.update',
			payload: {
				taskId: 'created-task',
				change: {
					state: 'ACTIVE',
					sortPosition: 300,
					completionDate: undefined
				}
			}
		})).resolves.toMatchObject({
			ok: true
		});

		expect(readPersistedTaskRows(storageDirectory)).toEqual([
			{
				id: 'created-task',
				text: 'Updated persisted task',
				state: 'ACTIVE',
				priority: 'LOW',
				owner: null,
				due_date: null,
				tags_json: '["storage","updated"]',
				sort_position: 300,
				completion_date: null,
				created_at: createdAt.toISOString(),
				updated_at: restoredAt.toISOString()
			}
		]);

		await expect(restoreTaskStorageInstance.executeTaskCommand({
			command: 'task.delete',
			payload: {
				taskId: 'created-task'
			}
		})).resolves.toMatchObject({
			ok: true
		});

		expect(readPersistedTaskRows(storageDirectory)).toEqual([]);
	});

	test('rejects task update commands that try to change an immutable task field', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const task: PersistedTask = {
			id: 'stable-task-id',
			text: 'Stable task ID',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 100,
			completionDate: undefined
		};
		insertPersistedTask(storageDirectory, task);
		const taskStorage = createTaskStorage({
			storageDirectory,
			now: () => {
				return new Date('2026-06-06T12:00:00.000Z');
			}
		});
		const command = {
			command: 'task.update',
			payload: {
				taskId: 'stable-task-id',
				change: {
					id: 'changed-task-id',
					text: 'Should not persist'
				}
			}
		} as unknown as TaskStorageCommand;

		const result = await taskStorage.executeTaskCommand(command);

		expect(result).toMatchObject({
			ok: false,
			reason: 'invalid-command',
			message: createImmutableTaskFieldChangeMessage('id', 'id'),
			status: {
				database: {
					state: 'healthy'
				}
			}
		});
		expect(readPersistedTaskRows(storageDirectory)).toEqual([
			{
				id: 'stable-task-id',
				text: 'Stable task ID',
				state: 'ACTIVE',
				priority: 'NORMAL',
				owner: null,
				due_date: null,
				tags_json: '[]',
				sort_position: 100,
				completion_date: null,
				created_at: '2026-06-06T10:00:00.000Z',
				updated_at: '2026-06-06T11:00:00.000Z'
			}
		]);
	});

	test('executes bulk task updates in one SQLite transaction', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const firstTask: PersistedTask = {
			id: 'bulk-task-a',
			text: 'Bulk task A',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 100,
			completionDate: undefined
		};
		const secondTask: PersistedTask = {
			id: 'bulk-task-b',
			text: 'Bulk task B',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 200,
			completionDate: undefined
		};
		insertPersistedTask(storageDirectory, firstTask);
		insertPersistedTask(storageDirectory, secondTask);
		const taskStorage = createTaskStorage({
			storageDirectory,
			now: () => {
				return new Date('2026-06-06T12:00:00.000Z');
			}
		});

		const result = await taskStorage.executeTaskCommand({
			command: 'tasks.updateMany',
			payload: {
				reason: 'manual-reorder',
				updates: [
					{
						taskId: 'bulk-task-a',
						change: {
							sortPosition: 300
						}
					},
					{
						taskId: 'bulk-task-b',
						change: {
							sortPosition: 400
						}
					}
				]
			}
		});

		expect(result).toMatchObject({
			ok: true
		});
		await expect(taskStorage.loadTasks()).resolves.toMatchObject({
			ok: true,
			tasks: [
				{
					id: 'bulk-task-a',
					sortPosition: 300
				},
				{
					id: 'bulk-task-b',
					sortPosition: 400
				}
			]
		});
	});

	test('rolls back a bulk update when one task update fails', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const task: PersistedTask = {
			id: 'rollback-task',
			text: 'Rollback task',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 100,
			completionDate: undefined
		};
		insertPersistedTask(storageDirectory, task);
		const taskStorage = createTaskStorage({
			storageDirectory,
			now: () => {
				return new Date('2026-06-06T12:00:00.000Z');
			}
		});

		const result = await taskStorage.executeTaskCommand({
			command: 'tasks.updateMany',
			payload: {
				reason: 'manual-reorder',
				updates: [
					{
						taskId: 'rollback-task',
						change: {
							text: 'Should roll back',
							sortPosition: 200
						}
					},
					{
						taskId: 'missing-task',
						change: {
							sortPosition: 300
						}
					}
				]
			}
		});

		expect(result).toMatchObject({
			ok: false,
			reason: 'database-error',
			message: 'Cannot update missing task "missing-task".'
		});
		expect(readPersistedTaskRows(storageDirectory)).toEqual([
			{
				id: 'rollback-task',
				text: 'Rollback task',
				state: 'ACTIVE',
				priority: 'NORMAL',
				owner: null,
				due_date: null,
				tags_json: '[]',
				sort_position: 100,
				completion_date: null,
				created_at: '2026-06-06T10:00:00.000Z',
				updated_at: '2026-06-06T11:00:00.000Z'
			}
		]);
	});
});
