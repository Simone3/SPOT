import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initializeSpotTestLogger } from '../testUtils';
import { BACKUP_CONFIG, LOGGING_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { appLogger, resetAppLoggerForTests, type CreateAppLoggerBackend, type CreateAppLoggerOptions } from 'src/framework/main/logging/AppLogger';
import { isBackupFileName } from 'src/framework/main/storage/DatabaseBackup';
import { STORAGE_CLOSED_MESSAGE } from 'src/framework/main/storage/DatabaseStorage';
import { openSpotDatabase } from 'src/main/storage/SpotDatabase';
import { TASK_INSERT_COLUMN_NAMES, TASK_SELECT_COLUMN_NAMES, createImmutableTaskFieldChangeMessage, createMissingRequiredTaskFieldMessage, taskRowToColumnValues, taskToTaskRow, type TaskRow } from 'src/main/storage/TaskRowMapping';
import { createTaskStorage, type CreateTaskStorageOptions, type OperationalLogEntry, type TaskStorage, type TaskStorageCommand } from 'src/main/storage/TaskStorage';
import type { PersistedTask } from 'src/types/TaskTypes';

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
	const spotDatabase = openSpotDatabase({
		storageDirectory,
		now: () => {
			return new Date('2026-06-06T09:00:00.000Z');
		}
	});
	const row = taskToTaskRow(task, {
		createdAt: new Date('2026-06-06T10:00:00.000Z'),
		updatedAt: new Date('2026-06-06T11:00:00.000Z')
	});
	const query = `
		INSERT INTO tasks (
${formatColumnList(TASK_INSERT_COLUMN_NAMES)}
		)
		VALUES (${createParameterList(TASK_INSERT_COLUMN_NAMES.length)})
	`;

	try {
		spotDatabase.runQuery(query, ...taskRowToColumnValues(row, TASK_INSERT_COLUMN_NAMES));
	}
	finally {
		spotDatabase.close();
	}
};

const insertRawTaskRow = (storageDirectory: string, row: TaskRow): void => {
	const spotDatabase = openSpotDatabase({
		storageDirectory,
		now: () => {
			return new Date('2026-06-06T09:00:00.000Z');
		}
	});
	const query = `
		INSERT INTO tasks (
${formatColumnList(TASK_INSERT_COLUMN_NAMES)}
		)
		VALUES (${createParameterList(TASK_INSERT_COLUMN_NAMES.length)})
	`;

	try {
		spotDatabase.runQuery(query, ...taskRowToColumnValues(row, TASK_INSERT_COLUMN_NAMES));
	}
	finally {
		spotDatabase.close();
	}
};

const readPersistedTaskRows = (storageDirectory: string): TaskRow[] => {
	const spotDatabase = openSpotDatabase({
		storageDirectory,
		now: () => {
			return new Date('2026-06-06T09:00:00.000Z');
		}
	});

	try {
		return spotDatabase.getAllQueryRows<TaskRow>(`
			SELECT
${formatColumnList(TASK_SELECT_COLUMN_NAMES)}
			FROM tasks
			ORDER BY id ASC
		`);
	}
	finally {
		spotDatabase.close();
	}
};

const readOperationalLogEntries = (storageDirectory: string): OperationalLogEntry[] => {
	const content = readFileSync(path.join(storageDirectory, LOGGING_CONFIG.fileName), 'utf8').trim();

	if(!content) {
		return [];
	}

	return content.split(/\r?\n/).map((line) => {
		return JSON.parse(line) as OperationalLogEntry;
	});
};

const createNoopBackendFactory = (): CreateAppLoggerBackend => {
	return () => {
		return {
			debug: () => {
				return undefined;
			},
			error: () => {
				return undefined;
			},
			info: () => {
				return undefined;
			},
			warn: () => {
				return undefined;
			},
			transports: {
				console: {
					level: 'info'
				},
				file: {
					level: 'info',
					fileName: '',
					format: ({ data }) => {
						return data;
					},
					maxSize: 0,
					resolvePathFn: () => {
						return '';
					},
					sync: false
				},
				ipc: {
					level: 'info'
				},
				remote: {
					level: 'info'
				}
			}
		};
	};
};

type CreateTrackedTaskStorageOptions = Partial<CreateTaskStorageOptions> & {
	logger?: Partial<Omit<CreateAppLoggerOptions, 'logDirectory'>>;
};

describe('TaskStorage', () => {
	const tempStorageDirectories: string[] = [];
	const taskStorageInstances: TaskStorage[] = [];

	const makeTrackedStorageDirectory = (): string => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);

		return storageDirectory;
	};

	const createTrackedTaskStorage = (options: CreateTrackedTaskStorageOptions = {}): TaskStorage => {
		const { logger, ...taskStorageOptions } = options;
		const databaseDirectory = taskStorageOptions.databaseDirectory ?? makeTrackedStorageDirectory();

		initializeSpotTestLogger({
			logDirectory: databaseDirectory,
			now: taskStorageOptions.now,
			...logger
		});

		const taskStorage = createTaskStorage({
			...taskStorageOptions,
			databaseDirectory,
			backupDirectory: taskStorageOptions.backupDirectory ?? path.join(databaseDirectory, BACKUP_CONFIG.directoryName)
		});
		taskStorageInstances.push(taskStorage);

		return taskStorage;
	};

	afterEach(async() => {
		while(taskStorageInstances.length > 0) {
			const taskStorage = taskStorageInstances.pop()!;
			await taskStorage.prepareForShutdown();
		}

		await appLogger.flush();
		resetAppLoggerForTests();

		while(tempStorageDirectories.length > 0) {
			const tempStorageDirectory = tempStorageDirectories.pop()!;
			rmSync(tempStorageDirectory, { recursive: true, force: true });
		}
	});

	test('writes a backup copy holding the stored tasks', async() => {
		const storageDirectory = makeTrackedStorageDirectory();
		const backupDirectory = makeTrackedStorageDirectory();
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
			backupDirectory
		});

		await taskStorage.executeTaskCommand({
			command: 'task.create',
			payload: {
				task: {
					id: 'backed-up-task',
					text: 'Backed up task',
					state: 'ACTIVE',
					priority: 'NORMAL',
					owner: undefined,
					dueDate: undefined,
					tags: [],
					sortPosition: 100,
					completionDate: undefined
				}
			}
		});

		const result = await taskStorage.createBackup();

		expect(result).toMatchObject({
			ok: true,
			status: {
				state: 'ok',
				directory: backupDirectory
			}
		});
		expect(readdirSync(backupDirectory).filter((fileName) => {
			return isBackupFileName(BACKUP_CONFIG, fileName);
		})).toHaveLength(1);

		// The backup has to be a database SPOT could open again, not just a file with the right name
		const restoredDirectory = makeTrackedStorageDirectory();
		copyFileSync(result.ok ? result.backupPath : '', path.join(restoredDirectory, STORAGE_CONFIG.databaseFileName));

		expect(readPersistedTaskRows(restoredDirectory).map((row) => {
			return row.text;
		})).toEqual([ 'Backed up task' ]);
	});

	test('reports a failed backup without making the database unhealthy', async() => {
		const storageDirectory = makeTrackedStorageDirectory();
		const backupDirectory = makeTrackedStorageDirectory();
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
			backupDirectory
		});

		// A file where the backup folder should be makes every write to it fail
		rmSync(backupDirectory, { recursive: true, force: true });
		writeFileSync(backupDirectory, 'not a folder', 'utf8');

		const result = await taskStorage.createBackup();

		expect(result.ok).toBe(false);
		expect(result.status.state).toBe('failed');
		await expect(taskStorage.getStorageStatus()).resolves.toMatchObject({
			database: {
				state: 'healthy'
			},
			backup: {
				state: 'failed'
			}
		});
	});

	test('loads an empty task list from a configured SQLite database', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const taskStorage = createTrackedTaskStorage({ databaseDirectory: storageDirectory });

		const result = await taskStorage.loadTasks();

		expect(result).toMatchObject({
			ok: true,
			tasks: [],
			status: {
				database: {
					state: 'healthy'
				},
				storageDirectory,
				databasePath: path.join(storageDirectory, STORAGE_CONFIG.databaseFileName),
				backup: expect.objectContaining({ state: 'idle' })
			}
		});
		expect(existsSync(path.join(storageDirectory, STORAGE_CONFIG.databaseFileName))).toBe(true);
	});

	test('reports configured storage status', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const taskStorage = createTrackedTaskStorage({ databaseDirectory: storageDirectory });

		const status = await taskStorage.getStorageStatus();

		expect(status).toEqual({
			database: {
				state: 'healthy'
			},
			storageDirectory,
			databasePath: path.join(storageDirectory, STORAGE_CONFIG.databaseFileName),
			backup: {
				state: 'idle',
				directory: path.join(storageDirectory, BACKUP_CONFIG.directoryName)
			}
		});
		expect(existsSync(path.join(storageDirectory, STORAGE_CONFIG.databaseFileName))).toBe(true);
	});

	test('reuses one SQLite connection until shutdown preparation closes it', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const taskStorage = createTrackedTaskStorage({ databaseDirectory: storageDirectory });

		await taskStorage.getStorageStatus();
		await taskStorage.loadTasks();
		await taskStorage.loadTasks();
		await taskStorage.prepareForShutdown();

		const schemaVersionReads = readOperationalLogEntries(storageDirectory).filter((entry) => {
			return entry.type === 'sql.query' && entry.query === 'SELECT version FROM schema_migrations ORDER BY version ASC';
		});

		expect(schemaVersionReads).toHaveLength(1);
	});

	test('never opens the database again once shutdown closed it', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const taskStorage = createTrackedTaskStorage({ databaseDirectory: storageDirectory });

		await taskStorage.loadTasks();
		await taskStorage.prepareForShutdown();

		// A command or a status query arriving after the quit drain must not reopen a connection nobody closes a second time, which
		// would leave the write-ahead log behind without ever checkpointing it
		const statusAfterShutdown = await taskStorage.getStorageStatus();
		const loadResultAfterShutdown = await taskStorage.loadTasks();
		const commandResultAfterShutdown = await taskStorage.executeTaskCommand({
			command: 'task.delete',
			payload: {
				taskId: 'any-task'
			}
		});

		expect(statusAfterShutdown.database).toEqual({
			state: 'unavailable',
			message: STORAGE_CLOSED_MESSAGE
		});
		expect(loadResultAfterShutdown).toMatchObject({
			ok: false,
			reason: 'database-error',
			message: STORAGE_CLOSED_MESSAGE
		});
		expect(commandResultAfterShutdown).toMatchObject({
			ok: false,
			reason: 'database-error',
			message: STORAGE_CLOSED_MESSAGE
		});

		const schemaVersionReads = readOperationalLogEntries(storageDirectory).filter((entry) => {
			return entry.type === 'sql.query' && entry.query === 'SELECT version FROM schema_migrations ORDER BY version ASC';
		});

		expect(schemaVersionReads).toHaveLength(1);
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
		const taskStorage = createTrackedTaskStorage({ databaseDirectory: storageDirectory });

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
				storageDirectory,
				databasePath: path.join(storageDirectory, STORAGE_CONFIG.databaseFileName),
				backup: expect.objectContaining({ state: 'idle' })
			}
		});
	});

	test('skips a malformed task row instead of failing the entire load', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
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
		insertPersistedTask(storageDirectory, activeTask);
		insertRawTaskRow(storageDirectory, {
			id: 'malformed-task',
			text: 'Malformed task',
			state: 'BOGUS',
			priority: 'URGENT',
			owner: null,
			due_date: null,
			tags_json: '[]',
			sort_position: 200,
			completion_date: null,
			created_at: '2026-06-06T10:00:00.000Z',
			updated_at: '2026-06-06T11:00:00.000Z'
		});
		const taskStorage = createTrackedTaskStorage({ databaseDirectory: storageDirectory });

		const result = await taskStorage.loadTasks();

		expect(result).toMatchObject({
			ok: true,
			tasks: [
				{
					...activeTask,
					visible: false
				}
			],
			status: {
				database: {
					state: 'healthy'
				}
			}
		});

		const logEntries = readOperationalLogEntries(storageDirectory);

		expect(logEntries).toEqual(expect.arrayContaining([
			expect.objectContaining({
				level: 'warn',
				message: 'Skipping malformed task row',
				taskId: 'malformed-task',
				error: 'Unsupported task state "BOGUS".'
			})
		]));
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
		const createTaskStorageInstance = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
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

		const updateTaskStorageInstance = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
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
				storageDirectory,
				databasePath: path.join(storageDirectory, STORAGE_CONFIG.databaseFileName),
				backup: expect.objectContaining({ state: 'idle' })
			}
		});

		const restoreTaskStorageInstance = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
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

	test('writes task commands and storage SQL queries to the operational log', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const createdTask: PersistedTask = {
			id: 'logged-task',
			text: 'Log this task command',
			state: 'ACTIVE',
			priority: 'HIGH',
			owner: 'Simone',
			dueDate: '2026-06-10',
			tags: [ 'storage', 'log' ],
			sortPosition: 100,
			completionDate: undefined
		};
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
			now: () => {
				return createdAt;
			}
		});

		await expect(taskStorage.executeTaskCommand({
			command: 'task.create',
			payload: {
				task: createdTask
			}
		})).resolves.toMatchObject({
			ok: true
		});
		await expect(taskStorage.loadTasks()).resolves.toMatchObject({
			ok: true
		});

		const logEntries = readOperationalLogEntries(storageDirectory);

		expect(logEntries).toEqual(expect.arrayContaining([
			expect.objectContaining({
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Renderer storage command received',
				type: 'react.command',
				command: 'task.create',
				payload: {
					task: expect.objectContaining({
						id: createdTask.id,
						text: createdTask.text,
						state: createdTask.state,
						priority: createdTask.priority,
						owner: createdTask.owner,
						dueDate: createdTask.dueDate,
						tags: createdTask.tags,
						sortPosition: createdTask.sortPosition
					})
				}
			}),
			expect.objectContaining({
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Storage SQL query completed',
				type: 'sql.query',
				query: expect.stringContaining('INSERT INTO tasks'),
				elapsedMillis: expect.any(Number),
				result: 'success'
			}),
			expect.objectContaining({
				createdAt: createdAt.toISOString(),
				level: 'info',
				message: 'Storage SQL query completed',
				type: 'sql.query',
				query: expect.stringContaining('SELECT id, text, state'),
				elapsedMillis: expect.any(Number),
				result: 'success'
			})
		]));
	});

	test('keeps SQLite writes valid when operational logging repeatedly fails', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const createdAt = new Date('2026-06-06T12:00:00.000Z');
		const createdTask: PersistedTask = {
			id: 'log-failure-task',
			text: 'Persist despite log failure',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 100,
			completionDate: undefined
		};
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
			now: () => {
				return createdAt;
			},
			logger: {
				backendFactory: createNoopBackendFactory()
			}
		});

		const result = await taskStorage.executeTaskCommand({
			command: 'task.create',
			payload: {
				task: createdTask
			}
		});

		expect(result).toMatchObject({
			ok: true,
			status: {
				database: {
					state: 'healthy'
				}
			}
		});
		if(result.ok) {
			expect(result.status).not.toHaveProperty('operationalLog');
		}
		expect(readPersistedTaskRows(storageDirectory)).toEqual([
			{
				id: 'log-failure-task',
				text: 'Persist despite log failure',
				state: 'ACTIVE',
				priority: 'NORMAL',
				owner: null,
				due_date: null,
				tags_json: '[]',
				sort_position: 100,
				completion_date: null,
				created_at: createdAt.toISOString(),
				updated_at: createdAt.toISOString()
			}
		]);
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
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
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

	test('rejects task update commands that clear a required task field', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const task: PersistedTask = {
			id: 'required-field-task-id',
			text: 'Required field task',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 100,
			completionDate: undefined
		};
		insertPersistedTask(storageDirectory, task);
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
			now: () => {
				return new Date('2026-06-06T12:00:00.000Z');
			}
		});
		const command = {
			command: 'task.update',
			payload: {
				taskId: 'required-field-task-id',
				change: {
					text: undefined
				}
			}
		} as unknown as TaskStorageCommand;

		const result = await taskStorage.executeTaskCommand(command);

		// The same change would be refused again in exactly the same way, so it must not look like a database failure the renderer retries forever
		expect(result).toMatchObject({
			ok: false,
			reason: 'invalid-command',
			message: createMissingRequiredTaskFieldMessage('text'),
			status: {
				database: {
					state: 'healthy'
				}
			}
		});
		expect(readPersistedTaskRows(storageDirectory)).toMatchObject([
			{
				id: 'required-field-task-id',
				text: 'Required field task',
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
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
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

	test('opens every transaction with an immediate write lock', async() => {
		const storageDirectory = makeTempStorageDirectory();
		tempStorageDirectories.push(storageDirectory);
		const task: PersistedTask = {
			id: 'immediate-transaction-task',
			text: 'Immediate transaction task',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 100,
			completionDate: undefined
		};
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
			now: () => {
				return new Date('2026-06-06T12:00:00.000Z');
			}
		});

		await expect(taskStorage.executeTaskCommand({
			command: 'task.create',
			payload: {
				task
			}
		})).resolves.toMatchObject({
			ok: true
		});

		const transactionStartQueries = readOperationalLogEntries(storageDirectory).flatMap((entry) => {
			if(entry.type !== 'sql.query' || !entry.query.startsWith('BEGIN')) {
				return [];
			}

			return [entry.query];
		});

		expect(transactionStartQueries.length).toBeGreaterThan(0);
		expect(new Set(transactionStartQueries)).toEqual(new Set(['BEGIN IMMEDIATE']));
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
		const taskStorage = createTrackedTaskStorage({
			databaseDirectory: storageDirectory,
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

		// A row that is not there will not appear later, so React must drop the command instead of retrying it forever
		expect(result).toMatchObject({
			ok: false,
			reason: 'invalid-command',
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
