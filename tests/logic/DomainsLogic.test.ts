import { makeTask } from '../testUtils';
import { addDomainsForTasks, getInitialDomains, removeDomainsForTask, updateDomainsForTask, updateFiltersOnDomainsChange } from 'src/logic/DomainsLogic';
import { getInitialFilters } from 'src/logic/FiltersLogic';
import type { DomainEntry } from 'src/types/DomainTypes';
import type { TaskFilters } from 'src/types/FilterTypes';
import type { TasksContainer } from 'src/types/TaskTypes';

const domainByValue = (domains: DomainEntry[], value: string): DomainEntry | undefined => {
	return domains.find((domain) => {
		return domain.value === value;
	});
};

const domainValues = (domains: DomainEntry[]): string[] => {
	return domains.map((domain) => {
		return domain.value;
	});
};

describe('DomainsLogic', () => {
	test('builds filter domains from active tasks and form domains from all tasks', () => {
		const activeAlice = makeTask({
			priority: 'HIGH',
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'work', 'home' ]
		});
		const activeNoDueDate = makeTask({
			priority: 'LOW',
			owner: 'Alice',
			dueDate: undefined,
			tags: [ 'work' ]
		});
		const completedBob = makeTask({
			state: 'COMPLETED',
			priority: 'URGENT',
			owner: 'Bob',
			dueDate: '2025-01-01',
			tags: [ 'archive' ],
			completionDate: new Date('2026-01-01')
		});
		const tasksContainer: TasksContainer = {
			active: [ activeAlice, activeNoDueDate ],
			completed: [ completedBob ]
		};
		const domainsContainer = getInitialDomains();

		addDomainsForTasks(domainsContainer, tasksContainer);

		expect(domainByValue(domainsContainer.filters.owners, 'Alice')?.count).toBe(2);
		expect(domainByValue(domainsContainer.filters.owners, 'Bob')).toBeUndefined();
		expect(domainByValue(domainsContainer.form.owners, 'Alice')?.count).toBe(2);
		expect(domainByValue(domainsContainer.form.owners, 'Bob')?.count).toBe(1);
		expect(domainByValue(domainsContainer.filters.dueDates, '2026-05-10')?.count).toBe(1);
		expect(domainByValue(domainsContainer.filters.dueDates, '2025-01-01')).toBeUndefined();
		expect(domainByValue(domainsContainer.filters.dueDates, '')?.count).toBe(1);
		expect(domainByValue(domainsContainer.filters.tags, 'work')?.count).toBe(2);
		expect(domainByValue(domainsContainer.filters.tags, 'archive')).toBeUndefined();
		expect(domainByValue(domainsContainer.form.tags, 'archive')?.count).toBe(1);
	});

	test('updates domain counters when active task fields change', () => {
		const oldTask = makeTask({
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'work' ]
		});
		const otherAliceTask = makeTask({
			owner: 'Alice',
			dueDate: '2026-05-11',
			tags: [ 'work' ]
		});
		const completedBobTask = makeTask({
			state: 'COMPLETED',
			owner: 'Bob',
			tags: [ 'archive' ],
			completionDate: new Date('2026-01-01')
		});
		const newTask = {
			...oldTask,
			owner: 'Bob',
			tags: [ 'personal' ]
		};
		const domainsContainer = getInitialDomains();

		addDomainsForTasks(domainsContainer, {
			active: [ oldTask, otherAliceTask ],
			completed: [ completedBobTask ]
		});
		updateDomainsForTask(domainsContainer, oldTask, newTask, {
			owner: 'Bob',
			tags: [ 'personal' ]
		});

		expect(domainByValue(domainsContainer.filters.owners, 'Alice')?.count).toBe(1);
		expect(domainByValue(domainsContainer.filters.owners, 'Bob')?.count).toBe(1);
		expect(domainByValue(domainsContainer.form.owners, 'Bob')?.count).toBe(2);
		expect(domainByValue(domainsContainer.filters.tags, 'work')?.count).toBe(1);
		expect(domainByValue(domainsContainer.filters.tags, 'personal')?.count).toBe(1);
	});

	test('sorts filter domains by value and form domains by descending count', () => {
		const tasksContainer: TasksContainer = {
			active: [
				makeTask({ owner: 'Zoe', tags: [ 'work' ] }),
				makeTask({ owner: 'Zoe', tags: [ 'work', 'home' ] }),
				makeTask({ owner: 'Alice', tags: [ 'work', 'home' ] }),
				makeTask({ owner: '', tags: [ 'errands' ] })
			],
			completed: []
		};
		const domainsContainer = getInitialDomains();

		addDomainsForTasks(domainsContainer, tasksContainer);

		expect(domainValues(domainsContainer.filters.owners)).toEqual([ '', 'Alice', 'Zoe' ]);
		expect(domainValues(domainsContainer.filters.tags)).toEqual([ 'errands', 'home', 'work' ]);

		// The persistent "no owner" entry stays first whatever its count, and equal counts fall back to the value order
		expect(domainValues(domainsContainer.form.owners)).toEqual([ '', 'Zoe', 'Alice' ]);
		expect(domainValues(domainsContainer.form.tags)).toEqual([ 'work', 'home', 'errands' ]);
	});

	test('offers a filter entry only while an active task matches it', () => {
		const domainsContainer = getInitialDomains();

		// Nothing is offered before a task calls for it, whatever the entry would have been worded from
		expect(domainsContainer.filters.priorities).toEqual([]);
		expect(domainsContainer.filters.owners).toEqual([]);
		expect(domainsContainer.filters.dueDates).toEqual([]);
		expect(domainsContainer.filters.tags).toEqual([]);

		// The form section still offers what it always offers, whatever the tasks look like
		expect(domainValues(domainsContainer.form.priorities)).toEqual([ 'URGENT', 'HIGH', 'NORMAL', 'LOW' ]);
		expect(domainValues(domainsContainer.form.owners)).toEqual([ '' ]);

		const highTask = makeTask({
			priority: 'HIGH',
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'work' ]
		});
		const barePriorityTask = makeTask({
			priority: 'URGENT',
			owner: undefined,
			dueDate: undefined,
			tags: []
		});

		addDomainsForTasks(domainsContainer, {
			active: [ highTask, barePriorityTask ],
			completed: []
		});

		// Only the two priorities in use are offered, in the order they mean rather than the one their values sort in
		expect(domainValues(domainsContainer.filters.priorities)).toEqual([ 'URGENT', 'HIGH' ]);
		expect(domainByValue(domainsContainer.filters.priorities, 'HIGH')?.labelKind).toBe('PRIORITY');
		expect(domainByValue(domainsContainer.filters.priorities, 'HIGH')?.color).toBe('var(--colors-priority-high)');

		// The entries standing for "no value" are worded, counted and first, exactly like the untagged one
		expect(domainValues(domainsContainer.filters.owners)).toEqual([ '', 'Alice' ]);
		expect(domainByValue(domainsContainer.filters.owners, '')?.labelKind).toBe('NO_OWNER');
		expect(domainByValue(domainsContainer.filters.dueDates, '')?.labelKind).toBe('NO_DUE_DATE');
		expect(domainByValue(domainsContainer.filters.tags, '')?.labelKind).toBe('NO_TAGS');

		// Giving the bare task everything the other one has takes all four entries away with it
		const filledTask = {
			...barePriorityTask,
			priority: 'HIGH' as const,
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'work' ]
		};
		updateDomainsForTask(domainsContainer, barePriorityTask, filledTask, {
			priority: 'HIGH',
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'work' ]
		});

		expect(domainValues(domainsContainer.filters.priorities)).toEqual([ 'HIGH' ]);
		expect(domainValues(domainsContainer.filters.owners)).toEqual([ 'Alice' ]);
		expect(domainValues(domainsContainer.filters.dueDates)).toEqual([ '2026-05-10' ]);
		expect(domainValues(domainsContainer.filters.tags)).toEqual([ 'work' ]);
	});

	test('cleans selected filters when the last matching active domain disappears', () => {
		const task = makeTask({
			priority: 'HIGH',
			owner: 'Alice',
			dueDate: '2026-05-10',
			tags: [ 'work' ]
		});
		const domainsContainer = getInitialDomains();
		const filters: TaskFilters = {
			...getInitialFilters(),
			owners: [ 'Alice', 'Missing' ],
			dueDates: [ '2026-05-10' ],
			priorities: [ 'HIGH' ],
			tags: [ 'work' ]
		};

		addDomainsForTasks(domainsContainer, {
			active: [ task ],
			completed: []
		});
		removeDomainsForTask(domainsContainer, task);
		updateFiltersOnDomainsChange(domainsContainer.filters, filters);

		expect(filters.owners).toEqual([]);
		expect(filters.dueDates).toEqual([]);
		expect(filters.tags).toEqual([]);

		// Priorities are counted like every other domain, so a selected one is cleaned when the last task carrying it goes
		expect(filters.priorities).toEqual([]);
	});

	test('offers the untagged filter entry only while some active task carries no tag', () => {
		const untaggedTask = makeTask({ tags: [] });
		const taggedTask = makeTask({ tags: [ 'work' ] });
		const untaggedCompletedTask = makeTask({
			state: 'COMPLETED',
			tags: [],
			completionDate: new Date('2026-01-01')
		});
		const domainsContainer = getInitialDomains();

		addDomainsForTasks(domainsContainer, {
			active: [ untaggedTask, taggedTask ],
			completed: [ untaggedCompletedTask ]
		});

		// The untagged entry stands first, is worded by its kind rather than by a task value, and never reaches the tags the form suggests
		expect(domainValues(domainsContainer.filters.tags)).toEqual([ '', 'work' ]);
		expect(domainByValue(domainsContainer.filters.tags, '')?.labelKind).toBe('NO_TAGS');
		expect(domainByValue(domainsContainer.filters.tags, '')?.count).toBe(1);
		expect(domainByValue(domainsContainer.form.tags, '')).toBeUndefined();

		// Tagging the last untagged active task takes the entry away, and untagging a task brings it back
		updateDomainsForTask(domainsContainer, untaggedTask, { ...untaggedTask, tags: [ 'home' ] }, { tags: [ 'home' ] });
		expect(domainByValue(domainsContainer.filters.tags, '')).toBeUndefined();

		updateDomainsForTask(domainsContainer, taggedTask, { ...taggedTask, tags: [] }, { tags: [] });
		expect(domainValues(domainsContainer.filters.tags)).toEqual([ '', 'home' ]);
		expect(domainByValue(domainsContainer.filters.tags, '')?.labelKind).toBe('NO_TAGS');
	});

	test('leaves the untagged entry alone for the empty tag a user is still typing', () => {
		const untaggedTask = makeTask({ tags: [] });
		const taggedTask = makeTask({ tags: [ 'work' ] });
		const typingTask = { ...taggedTask, tags: [ 'work', '' ] };
		const domainsContainer = getInitialDomains();

		addDomainsForTasks(domainsContainer, {
			active: [ untaggedTask, taggedTask ],
			completed: []
		});

		// The half-typed tag is neither a tag of its own nor a reason to count the task as untagged
		updateDomainsForTask(domainsContainer, taggedTask, typingTask, { tags: [ 'work', '' ] });
		expect(domainValues(domainsContainer.filters.tags)).toEqual([ '', 'work' ]);
		expect(domainByValue(domainsContainer.filters.tags, '')?.count).toBe(1);

		// Dropping it again leaves the untagged entry standing for the task that really has no tag
		updateDomainsForTask(domainsContainer, typingTask, taggedTask, { tags: [ 'work' ] });
		expect(domainValues(domainsContainer.filters.tags)).toEqual([ '', 'work' ]);
		expect(domainByValue(domainsContainer.filters.tags, '')?.count).toBe(1);
	});

	test('cleans the selected untagged filter when the last untagged active task is tagged', () => {
		const untaggedTask = makeTask({ tags: [] });
		const domainsContainer = getInitialDomains();
		const filters: TaskFilters = {
			...getInitialFilters(),
			tags: [ '' ]
		};

		addDomainsForTasks(domainsContainer, {
			active: [ untaggedTask ],
			completed: []
		});
		updateDomainsForTask(domainsContainer, untaggedTask, { ...untaggedTask, tags: [ 'work' ] }, { tags: [ 'work' ] });
		updateFiltersOnDomainsChange(domainsContainer.filters, filters);

		expect(filters.tags).toEqual([]);
	});
});
