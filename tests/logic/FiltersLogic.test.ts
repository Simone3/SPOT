import { makeTask } from '../testUtils';
import { cloneFilters, getInitialFilters, refreshTasksVisibility, refreshTaskVisibility } from 'src/logic/FiltersLogic';
import type { TaskFilters } from 'src/types/FilterTypes';
import type { TasksContainer } from 'src/types/TaskTypes';
import { cloneTask } from 'src/logic/TasksLogic';

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

		refreshTasksVisibility(tasksContainer, oldFilters, newFilters, cloneTask);

		expect(tasksContainer.active[0]).not.toBe(matchingTask);
		expect(tasksContainer.active[0].tags).not.toBe(matchingTask.tags);
		expect(tasksContainer.active[0].visible).toBe(true);
		expect(tasksContainer.active[1].visible).toBe(false);
		expect(tasksContainer.completed[0].completionDate).not.toBe(completedTask.completionDate);
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

	test('matches the empty tag filter value against tasks carrying no tag', () => {
		const untaggedTask = makeTask({ tags: [], visible: false });
		const taggedTask = makeTask({ tags: [ 'work' ], visible: true });

		refreshTaskVisibility(untaggedTask, {
			...getInitialFilters(),
			tags: [ '' ]
		});
		refreshTaskVisibility(taggedTask, {
			...getInitialFilters(),
			tags: [ '' ]
		});

		expect(untaggedTask.visible).toBe(true);
		expect(taggedTask.visible).toBe(false);
	});

	test('matches a task selected either by the empty tag filter value or by one of its own tags', () => {
		const untaggedTask = makeTask({ tags: [], visible: false });
		const taggedTask = makeTask({ tags: [ 'work' ], visible: false });
		const otherTaggedTask = makeTask({ tags: [ 'home' ], visible: true });

		for(const task of [ untaggedTask, taggedTask, otherTaggedTask ]) {
			refreshTaskVisibility(task, {
				...getInitialFilters(),
				tags: [ '', 'work' ]
			});
		}

		expect(untaggedTask.visible).toBe(true);
		expect(taggedTask.visible).toBe(true);
		expect(otherTaggedTask.visible).toBe(false);
	});

	test('treats a task whose only tag is the empty one still being typed as untagged', () => {
		const typingTask = makeTask({ tags: [ '' ], visible: false });

		refreshTaskVisibility(typingTask, {
			...getInitialFilters(),
			tags: [ '' ]
		});

		expect(typingTask.visible).toBe(true);
	});

	test('matches text as a plain literal substring, ignoring regex metacharacters', () => {
		const literalMatchTask = makeTask({ text: 'Write project (draft)', visible: false });
		const noMetacharacterMatchTask = makeTask({ text: 'Write projectXdraft', visible: false });

		refreshTaskVisibility(literalMatchTask, {
			...getInitialFilters(),
			text: '(draft)'
		});
		refreshTaskVisibility(noMetacharacterMatchTask, {
			...getInitialFilters(),
			text: 'project.draft'
		});

		expect(literalMatchTask.visible).toBe(true);
		expect(noMetacharacterMatchTask.visible).toBe(false);
	});
});
