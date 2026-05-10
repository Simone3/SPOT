import { makeTask, taskIds } from '../testUtils';
import { addNewTask, forceSortActiveTasksByImportance, getInitialTasks, loadBackEndTasks, updateTask } from 'src/logic/TasksLogic';
import type { TasksContainer } from 'src/types/TaskTypes';

describe('TasksLogic', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	test('loads backend tasks into state-specific sorted lists', () => {
		const tasksContainer = getInitialTasks();
		const activeLater = makeTask({ id: 'active-later', sortPosition: 20 });
		const activeFirst = makeTask({ id: 'active-first', sortPosition: 10 });
		const activeTie = makeTask({ id: 'active-tie', sortPosition: 10 });
		const completedOld = makeTask({
			id: 'completed-old',
			state: 'COMPLETED',
			completionDate: new Date('2024-01-01')
		});
		const completedNew = makeTask({
			id: 'completed-new',
			state: 'COMPLETED',
			completionDate: new Date('2024-02-01')
		});

		loadBackEndTasks(tasksContainer, [
			activeLater,
			completedOld,
			activeTie,
			completedNew,
			activeFirst
		]);

		expect(taskIds(tasksContainer.active)).toEqual([
			'active-first',
			'active-tie',
			'active-later'
		]);
		expect(taskIds(tasksContainer.completed)).toEqual([
			'completed-new',
			'completed-old'
		]);
	});

	test('sorts active tasks by priority, due date presence, due date descending, then manual position', () => {
		const tasksContainer: TasksContainer = {
			active: [
				makeTask({ id: 'normal', priority: 'NORMAL', dueDate: '2026-01-01', sortPosition: 0 }),
				makeTask({ id: 'high-old', priority: 'HIGH', dueDate: '2025-01-01', sortPosition: 100 }),
				makeTask({ id: 'urgent-no-date', priority: 'URGENT', sortPosition: 200 }),
				makeTask({ id: 'high-no-date', priority: 'HIGH', sortPosition: 300 }),
				makeTask({ id: 'high-new', priority: 'HIGH', dueDate: '2026-01-01', sortPosition: 400 }),
				makeTask({ id: 'high-same-date-first', priority: 'HIGH', dueDate: '2026-01-01', sortPosition: 350 })
			],
			completed: []
		};

		forceSortActiveTasksByImportance(tasksContainer);

		expect(taskIds(tasksContainer.active)).toEqual([
			'urgent-no-date',
			'high-same-date-first',
			'high-new',
			'high-old',
			'high-no-date',
			'normal'
		]);
		expect(tasksContainer.active.map((task) => {
			return task.sortPosition;
		})).toEqual([ 200, 350, 400, 1400, 2400, 3400 ]);
	});

	test('moves tasks between active and completed lists when state changes', () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-05-10T12:00:00Z'));

		const activeTask = makeTask({ id: 'active-task', sortPosition: 100 });
		const completedTask = makeTask({
			id: 'completed-task',
			state: 'COMPLETED',
			completionDate: new Date('2026-01-01'),
			sortPosition: 200
		});
		const tasksContainer: TasksContainer = {
			active: [ activeTask ],
			completed: [ completedTask ]
		};

		const newlyCompleted = updateTask(tasksContainer, activeTask, { state: 'COMPLETED' });

		expect(taskIds(tasksContainer.active)).toEqual([]);
		expect(taskIds(tasksContainer.completed)).toEqual([ 'active-task', 'completed-task' ]);
		expect(newlyCompleted.completionDate).toEqual(new Date('2026-05-10T12:00:00Z'));

		const reactivated = updateTask(tasksContainer, completedTask, { state: 'ACTIVE' });

		expect(taskIds(tasksContainer.active)).toEqual([ 'completed-task' ]);
		expect(taskIds(tasksContainer.completed)).toEqual([ 'active-task' ]);
		expect(reactivated.completionDate).toBeUndefined();
		expect(reactivated.sortPosition).toBe(0);
	});

	test('adds a new visible-ready active task with default values', () => {
		const tasksContainer = getInitialTasks();
		const newTask = addNewTask(tasksContainer);

		expect(newTask).toEqual({
			id: '00000000-0000-4000-8000-000000000001',
			text: '',
			state: 'ACTIVE',
			priority: 'HIGH',
			owner: undefined,
			dueDate: undefined,
			tags: [],
			sortPosition: 0,
			visible: false,
			completionDate: undefined
		});
		expect(tasksContainer.active).toEqual([ newTask ]);
		expect(tasksContainer.completed).toEqual([]);
	});
});
