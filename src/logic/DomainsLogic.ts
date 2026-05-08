
import type { DomainEntry, DomainsContainer, FilterDomains, FormDomains } from 'src/types/DomainTypes';
import type { Task, TaskChange, TasksContainer } from 'src/types/TaskTypes';
import type { TaskFilters } from 'src/types/FilterTypes';

type DomainsSection = Partial<FilterDomains & FormDomains>;

type FilterListField = 'priorities' | 'owners' | 'dueDates' | 'tags';

type TaskDomainHandler = {
	taskField: keyof Task;
	isTaskFieldList: boolean;
	domainListField: FilterListField;
	filtersField: FilterListField;
};

const PRIORITIES: DomainEntry[] = [{
	key: 'urgent',
	value: 'URGENT',
	label: 'Urgent',
	color: 'var(--colors-priority-urgent)',
	persistent: true,
	count: 0
}, {
	key: 'high',
	value: 'HIGH',
	label: 'High',
	color: 'var(--colors-priority-high)',
	persistent: true,
	count: 0
}, {
	key: 'normal',
	value: 'NORMAL',
	label: 'Normal',
	color: 'var(--colors-priority-normal)',
	persistent: true,
	count: 0
}, {
	key: 'low',
	value: 'LOW',
	label: 'Low',
	color: 'var(--colors-priority-low)',
	persistent: true,
	count: 0
}
];

const NO_OWNER: DomainEntry = {
	key: `no-owner-${crypto.randomUUID()}`,
	value: '',
	label: 'Me',
	color: undefined,
	persistent: true,
	count: 0
};

const NO_DUE_DATE: DomainEntry = {
	key: `no-due-date-${crypto.randomUUID()}`,
	value: '',
	label: 'None',
	color: undefined,
	persistent: true,
	count: 0
};

/**
 * Returns a new object containing the initial domains.
 * @returns Default filter and form domains.
 */
export const getInitialDomains = (): DomainsContainer => {
	return {
		filters: {
			priorities: PRIORITIES,
			owners: [ NO_OWNER ],
			dueDates: [ NO_DUE_DATE ],
			tags: []
		},
		form: {
			priorities: PRIORITIES,
			owners: [ NO_OWNER ],
			tags: []
		}
	};
};

/**
 * Clones the object and the contained lists (but not each domain entry).
 * @param domainsContainer Domains to clone.
 * @returns A shallow clone of the domains container.
 */
export const cloneDomains = (domainsContainer: DomainsContainer): DomainsContainer => {
	return {
		filters: {
			priorities: [ ...domainsContainer.filters.priorities ],
			owners: [ ...domainsContainer.filters.owners ],
			dueDates: [ ...domainsContainer.filters.dueDates ],
			tags: [ ...domainsContainer.filters.tags ]
		},
		form: {
			priorities: [ ...domainsContainer.form.priorities ],
			owners: [ ...domainsContainer.form.owners ],
			tags: [ ...domainsContainer.form.tags ]
		}
	};
};

/**
 * Comparator for domain entries (sort by value).
 * @param entryA First domain entry to compare.
 * @param entryB Second domain entry to compare.
 * @returns The domain value sort order.
 */
const domainCompareFunction = (entryA: DomainEntry, entryB: DomainEntry): number => {
	if(entryA.value < entryB.value) {
		return -1;
	}
	if(entryA.value > entryB.value) {
		return 1;
	}
	return 0;
};

/**
 * Sorts all domains.
 * @param domainsContainer Domain lists to sort in place.
 */
const sortAllDomains = (domainsContainer: DomainsContainer): void => {
	// Sort all lists (except priorities, which are already sorted by default)
	domainsContainer.filters.owners.sort(domainCompareFunction);
	domainsContainer.filters.dueDates.sort(domainCompareFunction);
	domainsContainer.filters.tags.sort(domainCompareFunction);
	domainsContainer.form.owners.sort(domainCompareFunction);
	domainsContainer.form.tags.sort(domainCompareFunction);
};

/**
 * Removes a domain value from a domain list (either by removing the entry altogether or by cloning & updating the entry counter).
 * @param domainsList Domain list to update.
 * @param oldDomainValue Domain value to remove.
 */
const removeDomain = (domainsList: DomainEntry[], oldDomainValue: string): void => {
	// Find old domain by value
	const domainIndex = domainsList.findIndex((domain) => {
		return domain.value === oldDomainValue;
	});
	if(domainIndex === -1) {
		return;
	}
	let domain = domainsList[domainIndex];

	if(domain.count <= 1 && !domain.persistent) {
		// Completely remove the entry from the list
		domainsList.splice(domainIndex, 1);
	}
	else {
		// Clone entry, update counter and update the list
		domain = { ...domain };
		domain.count -= 1;
		domainsList[domainIndex] = domain;
	}
};

/**
 * Adds a domain value to a domain list (either by creating a new entry or by cloning & updating an existing entry counter).
 * @param domainsList Domain list to update.
 * @param newDomainValue Domain value to add.
 */
const addDomain = (domainsList: DomainEntry[], newDomainValue: string): void => {
	// Find new domain by value
	const domainIndex = domainsList.findIndex((domain) => {
		return domain.value === newDomainValue;
	});

	// Skip new domain value if empty and there's no predefined entry for it
	if(domainIndex === -1 && !newDomainValue) {
		return;
	}

	let domain;
	if(domainIndex === -1) {
		// Create new entry and add it to the list
		domain = {
			key: newDomainValue,
			value: newDomainValue,
			label: newDomainValue,
			color: undefined,
			persistent: false,
			count: 1
		};
		domainsList.push(domain);
	}
	else {
		// Clone entry, update counter and update the list
		domain = { ...domainsList[domainIndex] };
		domain.count += 1;
		domainsList[domainIndex] = domain;
	}
};

/**
 * Returns the index in the domains list where the given domain value is located or -1 if not present.
 * @param domainsList Domain list to search.
 * @param domainValue Domain value to find.
 * @returns The domain entry index, or -1.
 */
const findDomain = (domainsList: DomainEntry[], domainValue: string): number => {
	for(let i = 0; i < domainsList.length; i++) {
		if(domainsList[i].value === domainValue) {
			return i;
		}
	}

	return -1;
};

/**
 * List of dynamic handlers that allow to extract values from tasks, domains and filters.
 */
const taskDomainHandlers: TaskDomainHandler[] = [
	{ taskField: 'priority', isTaskFieldList: false, domainListField: 'priorities', filtersField: 'priorities' },
	{ taskField: 'owner', isTaskFieldList: false, domainListField: 'owners', filtersField: 'owners' },
	{ taskField: 'dueDate', isTaskFieldList: false, domainListField: 'dueDates', filtersField: 'dueDates' },
	{ taskField: 'tags', isTaskFieldList: true, domainListField: 'tags', filtersField: 'tags' }
];

/**
 * Updates all domains of the given task in the given domains section.
 * If oldTask is empty, the domains are added.
 * If newTask is empty, the domains are removed.
 * @param domainsSection Domain section to update.
 * @param oldTask Previous task values, when present.
 * @param newTask New task values, when present.
 * @param changedTaskValues Task fields that changed.
 */
const updateDomainsForTaskInSection = (domainsSection: DomainsSection, oldTask: Task | undefined, newTask: Task | undefined, changedTaskValues: TaskChange | undefined): void => {
	// Loop all dynamic handlers
	for(const handler of taskDomainHandlers) {
		// Extract the handler's domains list (if present)
		const domainsList = domainsSection[handler.domainListField];
		if(!domainsList) {
			continue;
		}

		// If we have both old and new tasks but the domain value has not changed, no need to do anything
		if(oldTask && newTask && !(handler.taskField in changedTaskValues!)) {
			continue;
		}
	
		// Extract the handler's old and/or new values
		const oldDomainValue = oldTask ? oldTask[handler.taskField] : undefined;
		const newDomainValue = newTask ? newTask[handler.taskField] : undefined;

		// If the task value is actually a list, remove all old values and add all new values (for simplicity)
		if(handler.isTaskFieldList) {
			const oldDomainValues = oldDomainValue as string[] | undefined;
			const newDomainValues = newDomainValue as string[] | undefined;
			if(oldDomainValues) {
				for(const oldDomainValueElem of oldDomainValues) {
					removeDomain(domainsList, oldDomainValueElem);
				}
			}

			if(newDomainValues) {
				for(const newDomainValueElem of newDomainValues) {
					addDomain(domainsList, newDomainValueElem);
				}
			}
		}

		// If the task value is not a list, simply update the domain list directly.
		else {
			if(oldTask) {
				removeDomain(domainsList, typeof oldDomainValue === 'string' ? oldDomainValue : '');
			}
			if(newTask) {
				addDomain(domainsList, typeof newDomainValue === 'string' ? newDomainValue : '');
			}
		}
	}
};

/**
 * Helper to update any changed task domains in their respective domains lists, without sorting.
 * If oldTask is empty, the domains are added.
 * If newTask is empty, the domains are removed.
 * @param domainsContainer Domain lists to update.
 * @param oldTask Previous task values, when present.
 * @param newTask New task values, when present.
 * @param changedTaskValues Task fields that changed.
 */
const updateDomainsForTaskHelper = (domainsContainer: DomainsContainer, oldTask: Task | undefined, newTask: Task | undefined, changedTaskValues: TaskChange | undefined): void => {
	// The form section needs to be updated in any case (it contains domains for ALL tasks, both active and completed)
	updateDomainsForTaskInSection(domainsContainer.form, oldTask, newTask, changedTaskValues);

	// Update the filters section (it contains domains for the active tasks only)
	if(newTask && oldTask) {
		const oldActive = oldTask.state === 'ACTIVE';
		const newActive = newTask.state === 'ACTIVE';
		if(oldActive && !newActive) {
			// Task changes state to completed: remove the domains from filters section
			updateDomainsForTaskInSection(domainsContainer.filters, oldTask, undefined, undefined);
		}
		else if(!oldActive && newActive) {
			// Task changes state to active: add the domains to filters section
			updateDomainsForTaskInSection(domainsContainer.filters, undefined, newTask, undefined);
		}
		else if(oldActive && newActive) {
			// Task remains active: update the filters section
			updateDomainsForTaskInSection(domainsContainer.filters, oldTask, newTask, changedTaskValues);
		}
	}
	else if((oldTask && oldTask.state === 'ACTIVE') || (newTask && newTask.state === 'ACTIVE')) {
		// Add or remove active task: update the filters section
		updateDomainsForTaskInSection(domainsContainer.filters, oldTask, newTask, changedTaskValues);
	}
};

/**
 * Adds all domains of a given task to their respective domains lists, keeping them in order.
 * @param domainsContainer Domain lists to update.
 * @param task Task providing domain values.
 */
export const addDomainsForTask = (domainsContainer: DomainsContainer, task: Task): void => {
	updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined);
	sortAllDomains(domainsContainer);
};

/**
 * Removes all domains of a given task from their respective domains lists, keeping them in order.
 * @param domainsContainer Domain lists to update.
 * @param task Task providing domain values.
 */
export const removeDomainsForTask = (domainsContainer: DomainsContainer, task: Task): void => {
	updateDomainsForTaskHelper(domainsContainer, task, undefined, undefined);
	sortAllDomains(domainsContainer);
};

/**
 * Updates any changed task domains in their respective domains lists, keeping them in order.
 * @param domainsContainer Domain lists to update.
 * @param oldTask Previous task values.
 * @param newTask New task values.
 * @param changedTaskValues Task fields that changed.
 */
export const updateDomainsForTask = (domainsContainer: DomainsContainer, oldTask: Task, newTask: Task, changedTaskValues: TaskChange): void => {
	updateDomainsForTaskHelper(domainsContainer, oldTask, newTask, changedTaskValues);
	sortAllDomains(domainsContainer);
};

/**
 * For each task, adds all its domains to their respective domains lists, keeping them in order.
 * @param domainsContainer Domain lists to populate.
 * @param tasksContainer Task lists providing domain values.
 */
export const addDomainsForTasks = (domainsContainer: DomainsContainer, tasksContainer: TasksContainer): void => {
	for(const task of tasksContainer.active) {
		updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined);
	}

	for(const task of tasksContainer.completed) {
		updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined);
	}

	sortAllDomains(domainsContainer);
};

/**
 * Removes any filter that does not match the current domains values.
 * @param filtersDomains Current filter domain values.
 * @param filters Filters to update in place.
 */
export const updateFiltersOnDomainsChange = (filtersDomains: FilterDomains, filters: TaskFilters): void => {
	for(const handler of taskDomainHandlers) {
		const filterValues = filters[handler.filtersField];
		if(filterValues && filterValues.length > 0) {
			const domainsList = filtersDomains[handler.domainListField];

			// Loop all current filter values (backwards because of splice() re-indexing)
			for(let i = filterValues.length - 1; i >= 0; i--) {
				// Remove the filter value if it's not in the domains list
				if(findDomain(domainsList, filterValues[i]) === -1) {
					filterValues.splice(i, 1);
				}
			}
		}
	}
};
