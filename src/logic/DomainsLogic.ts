
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
	createEmptyListDomain?: (labels: DomainLabels) => DomainEntry;
};

/**
 * Wording for the domain entries the tasks themselves do not name: the ones that are always there, plus the one that stands for a task with no tag at all.
 * Only the labels are translated: the values next to them are what a task stores, so they never change with the language.
 */
export interface DomainLabels {
	urgent: string;
	high: string;
	normal: string;
	low: string;
	noOwner: string;
	noDueDate: string;
	noTags: string;
}

// The keys of the entries that stand for "no value" are random, so they can never collide with an owner, a due date or a tag a
// user typed. They are generated once, so that rebuilding the domains keeps React rendering the same elements.
const NO_OWNER_KEY = `no-owner-${crypto.randomUUID()}`;
const NO_DUE_DATE_KEY = `no-due-date-${crypto.randomUUID()}`;
const NO_TAGS_KEY = `no-tags-${crypto.randomUUID()}`;

const createPriorityDomains = (labels: DomainLabels): DomainEntry[] => {
	return [{
		key: 'urgent',
		value: 'URGENT',
		label: labels.urgent,
		color: 'var(--colors-priority-urgent)',
		persistent: true,
		count: 0
	}, {
		key: 'high',
		value: 'HIGH',
		label: labels.high,
		color: 'var(--colors-priority-high)',
		persistent: true,
		count: 0
	}, {
		key: 'normal',
		value: 'NORMAL',
		label: labels.normal,
		color: 'var(--colors-priority-normal)',
		persistent: true,
		count: 0
	}, {
		key: 'low',
		value: 'LOW',
		label: labels.low,
		color: 'var(--colors-priority-low)',
		persistent: true,
		count: 0
	}
	];
};

const createNoOwnerDomain = (labels: DomainLabels): DomainEntry => {
	return {
		key: NO_OWNER_KEY,
		value: '',
		label: labels.noOwner,
		color: undefined,
		persistent: true,
		count: 0
	};
};

const createNoDueDateDomain = (labels: DomainLabels): DomainEntry => {
	return {
		key: NO_DUE_DATE_KEY,
		value: '',
		label: labels.noDueDate,
		color: undefined,
		persistent: true,
		count: 0
	};
};

// Unlike the other entries that stand for "no value", this one is not persistent: it is counted like a tag, so the filters
// only offer it while some task carries no tag at all. It is therefore built when the first such task needs it, already counting it.
const createNoTagsDomain = (labels: DomainLabels): DomainEntry => {
	return {
		key: NO_TAGS_KEY,
		value: '',
		label: labels.noTags,
		color: undefined,
		persistent: false,
		count: 1
	};
};

/**
 * Returns a new object containing the initial domains.
 * Every list is built fresh, so the filter section and the form section count their entries on their own.
 * @param labels Wording for the entries that are always present.
 * @returns Default filter and form domains.
 */
export const getInitialDomains = (labels: DomainLabels): DomainsContainer => {
	return {
		filters: {
			priorities: createPriorityDomains(labels),
			owners: [ createNoOwnerDomain(labels) ],
			dueDates: [ createNoDueDateDomain(labels) ],
			tags: []
		},
		form: {
			priorities: createPriorityDomains(labels),
			owners: [ createNoOwnerDomain(labels) ],
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
const domainValueCompareFunction = (entryA: DomainEntry, entryB: DomainEntry): number => {
	if(entryA.value < entryB.value) {
		return -1;
	}
	if(entryA.value > entryB.value) {
		return 1;
	}
	return 0;
};

/**
 * Comparator for domain entries (persistent entries first, then by descending count, then by value).
 * @param entryA First domain entry to compare.
 * @param entryB Second domain entry to compare.
 * @returns The domain count sort order.
 */
const domainCountCompareFunction = (entryA: DomainEntry, entryB: DomainEntry): number => {
	if(entryA.persistent !== entryB.persistent) {
		return entryA.persistent ? -1 : 1;
	}
	if(entryA.count !== entryB.count) {
		return entryB.count - entryA.count;
	}
	return domainValueCompareFunction(entryA, entryB);
};

/**
 * Sorts all domains.
 * @param domainsContainer Domain lists to sort in place.
 */
const sortAllDomains = (domainsContainer: DomainsContainer): void => {
	// The filter lists are a checklist the user reads front to back, so they stay in value order (priorities are already
	// sorted by default). That is what keeps the entries standing for "no value" first, since the empty string sorts before
	// anything a user can type. The form lists are suggestions the user picks one entry from, so the most used ones come
	// first, with the entry that stands for "no value" kept at the top because it is the default rather than a suggestion.
	domainsContainer.filters.owners.sort(domainValueCompareFunction);
	domainsContainer.filters.dueDates.sort(domainValueCompareFunction);
	domainsContainer.filters.tags.sort(domainValueCompareFunction);
	domainsContainer.form.owners.sort(domainCountCompareFunction);
	domainsContainer.form.tags.sort(domainCountCompareFunction);
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
 * @param createMissingDomain Builds the entry when the list does not carry it yet, for the values that need more than their own text.
 */
const addDomain = (domainsList: DomainEntry[], newDomainValue: string, createMissingDomain?: () => DomainEntry): void => {
	// Find new domain by value
	const domainIndex = domainsList.findIndex((domain) => {
		return domain.value === newDomainValue;
	});

	// Skip new domain value if empty and there's no predefined entry for it
	if(domainIndex === -1 && !newDomainValue && !createMissingDomain) {
		return;
	}

	let domain;
	if(domainIndex === -1) {
		// Create new entry and add it to the list
		domain = createMissingDomain ?
			createMissingDomain() :
			{
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
	{ taskField: 'tags', isTaskFieldList: true, domainListField: 'tags', filtersField: 'tags', createEmptyListDomain: createNoTagsDomain }
];

/**
 * Updates all domains of the given task in the given domains section.
 * If oldTask is empty, the domains are added.
 * If newTask is empty, the domains are removed.
 * @param domainsSection Domain section to update.
 * @param oldTask Previous task values, when present.
 * @param newTask New task values, when present.
 * @param changedTaskValues Task fields that changed.
 * @param emptyListLabels Wording for the entries that stand for an empty task list, or nothing for a section that does not offer them.
 */
const updateDomainsForTaskInSection = (domainsSection: DomainsSection, oldTask: Task | undefined, newTask: Task | undefined, changedTaskValues: TaskChange | undefined, emptyListLabels: DomainLabels | undefined): void => {
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
			// A value the user has started typing but not finished is empty and stands for nothing, so it is neither a domain
			// of its own nor something that keeps the list from being empty
			const oldDomainValues = (oldDomainValue as string[] | undefined)?.filter((domainValue) => {
				return Boolean(domainValue);
			});
			const newDomainValues = (newDomainValue as string[] | undefined)?.filter((domainValue) => {
				return Boolean(domainValue);
			});

			// An empty list is a value of its own, counted under the empty domain value like a missing owner or due date is,
			// but only in the sections that offer it: the form lists suggest values to type, and "no value" is not one of them.
			const createEmptyListDomain = handler.createEmptyListDomain;
			const emptyListDomainFactory = emptyListLabels && createEmptyListDomain ?
				(): DomainEntry => {
					return createEmptyListDomain(emptyListLabels);
				} :
				undefined;

			if(oldDomainValues && oldDomainValues.length > 0) {
				for(const oldDomainValueElem of oldDomainValues) {
					removeDomain(domainsList, oldDomainValueElem);
				}
			}
			else if(oldDomainValues && emptyListDomainFactory) {
				removeDomain(domainsList, '');
			}

			if(newDomainValues && newDomainValues.length > 0) {
				for(const newDomainValueElem of newDomainValues) {
					addDomain(domainsList, newDomainValueElem);
				}
			}
			else if(newDomainValues && emptyListDomainFactory) {
				addDomain(domainsList, '', emptyListDomainFactory);
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
 * @param labels Wording for the entries the tasks themselves do not name.
 */
const updateDomainsForTaskHelper = (domainsContainer: DomainsContainer, oldTask: Task | undefined, newTask: Task | undefined, changedTaskValues: TaskChange | undefined, labels: DomainLabels): void => {
	// The form section needs to be updated in any case (it contains domains for ALL tasks, both active and completed)
	updateDomainsForTaskInSection(domainsContainer.form, oldTask, newTask, changedTaskValues, undefined);

	// Update the filters section (it contains domains for the active tasks only)
	if(newTask && oldTask) {
		const oldActive = oldTask.state === 'ACTIVE';
		const newActive = newTask.state === 'ACTIVE';
		if(oldActive && !newActive) {
			// Task changes state to completed: remove the domains from filters section
			updateDomainsForTaskInSection(domainsContainer.filters, oldTask, undefined, undefined, labels);
		}
		else if(!oldActive && newActive) {
			// Task changes state to active: add the domains to filters section
			updateDomainsForTaskInSection(domainsContainer.filters, undefined, newTask, undefined, labels);
		}
		else if(oldActive && newActive) {
			// Task remains active: update the filters section
			updateDomainsForTaskInSection(domainsContainer.filters, oldTask, newTask, changedTaskValues, labels);
		}
	}
	else if((oldTask && oldTask.state === 'ACTIVE') || (newTask && newTask.state === 'ACTIVE')) {
		// Add or remove active task: update the filters section
		updateDomainsForTaskInSection(domainsContainer.filters, oldTask, newTask, changedTaskValues, labels);
	}
};

/**
 * Adds all domains of a given task to their respective domains lists, keeping them in order.
 * @param domainsContainer Domain lists to update.
 * @param task Task providing domain values.
 * @param labels Wording for the entries the tasks themselves do not name.
 */
export const addDomainsForTask = (domainsContainer: DomainsContainer, task: Task, labels: DomainLabels): void => {
	updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined, labels);
	sortAllDomains(domainsContainer);
};

/**
 * Removes all domains of a given task from their respective domains lists, keeping them in order.
 * @param domainsContainer Domain lists to update.
 * @param task Task providing domain values.
 * @param labels Wording for the entries the tasks themselves do not name.
 */
export const removeDomainsForTask = (domainsContainer: DomainsContainer, task: Task, labels: DomainLabels): void => {
	updateDomainsForTaskHelper(domainsContainer, task, undefined, undefined, labels);
	sortAllDomains(domainsContainer);
};

/**
 * Updates any changed task domains in their respective domains lists, keeping them in order.
 * @param domainsContainer Domain lists to update.
 * @param oldTask Previous task values.
 * @param newTask New task values.
 * @param changedTaskValues Task fields that changed.
 * @param labels Wording for the entries the tasks themselves do not name.
 */
export const updateDomainsForTask = (domainsContainer: DomainsContainer, oldTask: Task, newTask: Task, changedTaskValues: TaskChange, labels: DomainLabels): void => {
	updateDomainsForTaskHelper(domainsContainer, oldTask, newTask, changedTaskValues, labels);
	sortAllDomains(domainsContainer);
};

/**
 * For each task, adds all its domains to their respective domains lists, keeping them in order.
 * @param domainsContainer Domain lists to populate.
 * @param tasksContainer Task lists providing domain values.
 * @param labels Wording for the entries the tasks themselves do not name.
 */
export const addDomainsForTasks = (domainsContainer: DomainsContainer, tasksContainer: TasksContainer, labels: DomainLabels): void => {
	for(const task of tasksContainer.active) {
		updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined, labels);
	}

	for(const task of tasksContainer.completed) {
		updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined, labels);
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
