import { makeTask, taskIds } from '../testUtils';
import { addNewTask, cloneTasks, forceSortActiveTasksByImportance, getInitialTasks, loadBackEndTasks, moveActiveTask, updateTask } from 'src/logic/TasksLogic';
import type { TasksContainer } from 'src/types/TaskTypes';

describe('TasksLogic', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test('shallow-clones task containers while sharing task objects', () => {
		const activeTask = makeTask({
			tags: [ 'work' ],
			sortPosition: 100
		});
		const completedTask = makeTask({
			state: 'COMPLETED',
			tags: [ 'done' ],
			completionDate: new Date('2026-05-01'),
			sortPosition: 200
		});
		const tasksContainer: TasksContainer = {
			active: [ activeTask ],
			completed: [ completedTask ]
		};

		const clonedTasksContainer = cloneTasks(tasksContainer);

		expect(clonedTasksContainer).not.toBe(tasksContainer);
		expect(clonedTasksContainer.active).not.toBe(tasksContainer.active);
		expect(clonedTasksContainer.completed).not.toBe(tasksContainer.completed);
		expect(clonedTasksContainer.active[0]).toBe(activeTask);
		expect(clonedTasksContainer.active[0].tags).toBe(activeTask.tags);
		expect(clonedTasksContainer.completed[0]).toBe(completedTask);
		expect(clonedTasksContainer.completed[0].completionDate).toBe(completedTask.completionDate);
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

	test('keeps loading every task when a completed one has no completion date', () => {
		const tasksContainer = getInitialTasks();

		// A completed row stored without a completion date must not hide all the other tasks behind a load failure
		loadBackEndTasks(tasksContainer, [
			makeTask({ id: 'completed-without-date', state: 'COMPLETED', completionDate: undefined }),
			makeTask({ id: 'completed-with-date', state: 'COMPLETED', completionDate: new Date('2024-01-01') }),
			makeTask({ id: 'active', sortPosition: 10 })
		]);

		expect(taskIds(tasksContainer.completed)).toEqual([
			'completed-with-date',
			'completed-without-date'
		]);
		expect(taskIds(tasksContainer.active)).toEqual([ 'active' ]);
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

	test('preserves source task objects when sorting a cloned container', () => {
		const normalTask = makeTask({ id: 'normal', priority: 'NORMAL', sortPosition: 0 });
		const urgentTask = makeTask({ id: 'urgent', priority: 'URGENT', sortPosition: 100 });
		const tasksContainer: TasksContainer = {
			active: [ normalTask, urgentTask ],
			completed: []
		};
		const clonedTasksContainer = cloneTasks(tasksContainer);

		forceSortActiveTasksByImportance(clonedTasksContainer);

		expect(taskIds(clonedTasksContainer.active)).toEqual([ 'urgent', 'normal' ]);
		expect(clonedTasksContainer.active.map((task) => {
			return task.sortPosition;
		})).toEqual([ 100, 1100 ]);
		expect(clonedTasksContainer.active[0]).toBe(urgentTask);
		expect(clonedTasksContainer.active[1]).not.toBe(normalTask);
		expect(taskIds(tasksContainer.active)).toEqual([ 'normal', 'urgent' ]);
		expect(tasksContainer.active.map((task) => {
			return task.sortPosition;
		})).toEqual([ 0, 100 ]);
	});

	test('preserves source task objects when moving tasks in a cloned container', () => {
		const firstTask = makeTask({ id: 'first', sortPosition: 100 });
		const secondTask = makeTask({ id: 'second', sortPosition: 200 });
		const thirdTask = makeTask({ id: 'third', sortPosition: 300 });
		const tasksContainer: TasksContainer = {
			active: [ firstTask, secondTask, thirdTask ],
			completed: []
		};
		const clonedTasksContainer = cloneTasks(tasksContainer);

		moveActiveTask(clonedTasksContainer, 2, 0);

		expect(taskIds(clonedTasksContainer.active)).toEqual([ 'third', 'first', 'second' ]);
		expect(clonedTasksContainer.active[0].sortPosition).toBe(-900);
		expect(clonedTasksContainer.active[0]).not.toBe(thirdTask);
		expect(clonedTasksContainer.active[1]).toBe(firstTask);
		expect(clonedTasksContainer.active[2]).toBe(secondTask);
		expect(taskIds(tasksContainer.active)).toEqual([ 'first', 'second', 'third' ]);
		expect(tasksContainer.active.map((task) => {
			return task.sortPosition;
		})).toEqual([ 100, 200, 300 ]);
	});

	test('clones every task whose sort position is recomputed during a move', () => {
		const firstTask = makeTask({ id: 'first', sortPosition: 0 });
		const secondTask = makeTask({ id: 'second', sortPosition: 1 });
		const thirdTask = makeTask({ id: 'third', sortPosition: 2 });
		const tasksContainer: TasksContainer = {
			active: [ firstTask, secondTask, thirdTask ],
			completed: []
		};
		const clonedTasksContainer = cloneTasks(tasksContainer);

		moveActiveTask(clonedTasksContainer, 2, 1);

		expect(taskIds(clonedTasksContainer.active)).toEqual([ 'first', 'third', 'second' ]);
		expect(clonedTasksContainer.active.map((task) => {
			return task.sortPosition;
		})).toEqual([ 0, 1000, 2000 ]);
		expect(clonedTasksContainer.active[0]).toBe(firstTask);
		expect(clonedTasksContainer.active[1]).not.toBe(thirdTask);
		expect(clonedTasksContainer.active[2]).not.toBe(secondTask);
		expect(tasksContainer.active.map((task) => {
			return task.sortPosition;
		})).toEqual([ 0, 1, 2 ]);
	});

	test('updates tasks without sharing mutable fields with the previous task', () => {
		const oldTask = makeTask({
			tags: [ 'old' ],
			completionDate: new Date('2026-01-01')
		});
		const tasksContainer: TasksContainer = {
			active: [ oldTask ],
			completed: []
		};

		const updatedTask = updateTask(tasksContainer, oldTask, { text: 'Updated task' });

		expect(updatedTask).not.toBe(oldTask);
		expect(updatedTask.tags).not.toBe(oldTask.tags);
		expect(updatedTask.completionDate).not.toBe(oldTask.completionDate);

		updatedTask.tags.push('new');
		updatedTask.completionDate!.setFullYear(2030);

		expect(oldTask.tags).toEqual([ 'old' ]);
		expect(oldTask.completionDate).toEqual(new Date('2026-01-01'));
	});

	test('moves tasks between active and completed lists when state changes', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));

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
