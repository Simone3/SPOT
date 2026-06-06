import { taskRowToTask, taskToTaskRow, type TaskRow } from 'src/main/storage/TaskRowMapping';
import type { PersistedTask } from 'src/main/storage/TaskStorage';

describe('TaskRowMapping', () => {
	test('serializes tags, dates, visibility, and completion dates for SQLite rows', () => {
		const createdAt = new Date('2026-06-06T10:00:00.000Z');
		const updatedAt = new Date('2026-06-06T11:00:00.000Z');
		const completionDate = new Date('2026-06-06T12:00:00.000Z');
		const task: PersistedTask = {
			id: 'task-1',
			text: 'Finish persistence mapping',
			state: 'COMPLETED',
			priority: 'HIGH',
			owner: 'Simone',
			dueDate: '2026-06-10',
			tags: [ 'storage', 'sqlite' ],
			sortPosition: 300,
			completionDate
		};

		const row = taskToTaskRow(task, { createdAt, updatedAt });

		expect(row).toEqual({
			id: 'task-1',
			text: 'Finish persistence mapping',
			state: 'COMPLETED',
			priority: 'HIGH',
			owner: 'Simone',
			due_date: '2026-06-10',
			tags_json: '["storage","sqlite"]',
			sort_position: 300,
			completion_date: completionDate.toISOString(),
			created_at: createdAt.toISOString(),
			updated_at: updatedAt.toISOString()
		});
		expect(row).not.toHaveProperty('visible');

		const mappedTask = taskRowToTask(row);

		expect(mappedTask).toEqual({
			...task,
			visible: false
		});
		expect(mappedTask.tags).not.toBe(task.tags);
		expect(mappedTask.completionDate).not.toBe(completionDate);
	});

	test('maps nullable row fields back to optional task fields', () => {
		const row: TaskRow = {
			id: 'task-2',
			text: 'Task without optional values',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: null,
			due_date: null,
			tags_json: '[]',
			sort_position: 0,
			completion_date: null,
			created_at: '2026-06-06T10:00:00.000Z',
			updated_at: '2026-06-06T11:00:00.000Z'
		};

		expect(taskRowToTask(row)).toEqual({
			id: 'task-2',
			text: 'Task without optional values',
			state: 'ACTIVE',
			priority: 'NORMAL',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 0,
			visible: false,
			completionDate: undefined
		});
	});
});
