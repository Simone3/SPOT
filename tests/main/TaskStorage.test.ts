import { createTaskStorage, STORAGE_NOT_IMPLEMENTED_MESSAGE, type OperationalLogEntry, type TaskStorageCommand } from 'src/main/storage/TaskStorage';

describe('TaskStorage', () => {
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
});
