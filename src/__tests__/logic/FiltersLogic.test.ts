import { cloneFilters, getInitialFilters, refreshTasksVisibility, refreshTaskVisibility } from 'src/logic/FiltersLogic';
import { makeTask } from 'src/testUtils/TaskTestFactory';
import type { TaskFilters } from 'src/types/FilterTypes';
import type { TasksContainer } from 'src/types/TaskTypes';

describe('FiltersLogic', () => {
	test('clones filters without sharing array fields', () => {
		const filters = {
			...getInitialFilters(),
			text: 'report',
			owners: [ 'Alice' ],
			dueDates: [ '2026-05-10' ],
			priorities: [ 'HIGH' ],
			tags: [ 'work' ],
			showCompleted: true
		} satisfies TaskFilters;

		const clonedFilters = cloneFilters(filters);
		clonedFilters.owners.push('Bob');
		clonedFilters.tags.push('home');

		expect(clonedFilters).not.toBe(filters);
		expect(filters.owners).toEqual([ 'Alice' ]);
		expect(filters.tags).toEqual([ 'work' ]);
	});

	test('matches text, priority, owner, due date, tag, and completed visibility filters', () => {
		const matchingTask = makeTask({
			text: 'Write project report',
			priority: 'HIGH',
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'work' ],
			visible: false
		});
		const wrongTagTask = makeTask({
			text: 'Write project report',
			priority: 'HIGH',
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'home' ],
			visible: true
		});
		const completedTask = makeTask({
			text: 'Write project report',
			state: 'COMPLETED',
			priority: 'HIGH',
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'work' ],
			visible: true,
			completionDate: new Date('2026-05-01')
		});
		const tasksContainer: TasksContainer = {
			active: [ matchingTask, wrongTagTask ],
			completed: [ completedTask ]
		};
		const oldFilters = {
			...getInitialFilters(),
			showCompleted: true
		};
		const newFilters: TaskFilters = {
			text: 'REPORT',
			owners: [ 'Alice' ],
			dueDates: [ '2026-05-10' ],
			priorities: [ 'HIGH' ],
			tags: [ 'work' ],
			showCompleted: false
		};

		refreshTasksVisibility(tasksContainer, oldFilters, newFilters);

		expect(tasksContainer.active[0]).not.toBe(matchingTask);
		expect(tasksContainer.active[0].visible).toBe(true);
		expect(tasksContainer.active[1].visible).toBe(false);
		expect(tasksContainer.completed[0].visible).toBe(false);
	});

	test('shows completed tasks when showCompleted is enabled', () => {
		const completedTask = makeTask({
			state: 'COMPLETED',
			completionDate: new Date('2026-05-01'),
			visible: false
		});

		refreshTaskVisibility(completedTask, {
			...getInitialFilters(),
			showCompleted: true
		});

		expect(completedTask.visible).toBe(true);
	});

	test('matches empty owner and empty due date domains against missing task values', () => {
		const task = makeTask({
			owner: undefined,
			dueDate: undefined,
			visible: false
		});

		refreshTaskVisibility(task, {
			...getInitialFilters(),
			owners: [ '' ],
			dueDates: [ '' ]
		});

		expect(task.visible).toBe(true);
	});
});
