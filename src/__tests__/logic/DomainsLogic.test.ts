import { addDomainsForTasks, getInitialDomains, removeDomainsForTask, updateDomainsForTask, updateFiltersOnDomainsChange } from 'src/logic/DomainsLogic';
import { getInitialFilters } from 'src/logic/FiltersLogic';
import { makeTask } from 'src/testUtils/TaskTestFactory';
import type { DomainEntry } from 'src/types/DomainTypes';
import type { TaskFilters } from 'src/types/FilterTypes';
import type { TasksContainer } from 'src/types/TaskTypes';

const domainByValue = (domains: DomainEntry[], value: string): DomainEntry | undefined => {
	return domains.find((domain) => {
		return domain.value === value;
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
		expect(filters.priorities).toEqual([ 'HIGH' ]);
	});
});
