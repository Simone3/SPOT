import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DATABASE_FILE_NAME, openTaskDatabase } from 'src/main/storage/TaskDatabase';
import { taskToTaskRow } from 'src/main/storage/TaskRowMapping';
import { createTaskStorage, OPERATIONAL_LOG_FILE_NAME, OPERATIONAL_LOG_NOT_IMPLEMENTED_MESSAGE, STORAGE_NOT_IMPLEMENTED_MESSAGE, type OperationalLogEntry, type PersistedTask, type TaskStorageCommand } from 'src/main/storage/TaskStorage';

const makeTempStorageDirectory = (): string => {
	return mkdtempSync(path.join(tmpdir(), 'spot-storage-'));
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
				id,
				text,
				state,
				priority,
				owner,
				due_date,
				tags_json,
				sort_position,
				completion_date,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			row.id,
			row.text,
			row.state,
			row.priority,
			row.owner,
			row.due_date,
			row.tags_json,
			row.sort_position,
			row.completion_date,
			row.created_at,
			row.updated_at
		);
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

	test('reports configured read-only storage status', async() => {
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
});
