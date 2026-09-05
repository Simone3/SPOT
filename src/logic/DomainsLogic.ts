
import type { DomainEntry, DomainsContainer, FilterDomains, FormDomains } from 'src/types/DomainTypes';
import type { Task, TaskChange, TaskPriorityValue, TasksContainer } from 'src/types/TaskTypes';
import type { TaskFilters } from 'src/types/FilterTypes';

type DomainsSection = Partial<FilterDomains & FormDomains>;

type FilterListField = 'priorities' | 'owners' | 'dueDates' | 'tags';

type PriorityDomainDefinition = {
	value: TaskPriorityValue;
	key: 'urgent' | 'high' | 'normal' | 'low';
};

type TaskDomainHandler = {
	taskField: keyof Task;
	isTaskFieldList: boolean;
	domainListField: FilterListField;
	filtersField: FilterListField;
	createFilterDomain: (domainValue: string, labels: DomainLabels) => DomainEntry | undefined;
};

/**
 * Wording for the domain entries the tasks do not name themselves: the priorities, and the ones that stand for a task with no owner, no due date or no tag at all.
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

// The priorities, in the order they mean rather than the one their values would sort in. The key doubles as the label field
// and as the colour suffix, so a priority is named the same way wherever it is built.
const PRIORITY_DOMAIN_DEFINITIONS: PriorityDomainDefinition[] = [
	{ value: 'URGENT', key: 'urgent' },
	{ value: 'HIGH', key: 'high' },
	{ value: 'NORMAL', key: 'normal' },
	{ value: 'LOW', key: 'low' }
];

const createPriorityDomain = (definition: PriorityDomainDefinition, labels: DomainLabels, persistent: boolean, count: number): DomainEntry => {
	return {
		key: definition.key,
		value: definition.value,
		label: labels[definition.key],
		color: `var(--colors-priority-${definition.key})`,
		persistent,
		count
	};
};

const createPriorityDomains = (labels: DomainLabels): DomainEntry[] => {
	return PRIORITY_DOMAIN_DEFINITIONS.map((definition) => {
		return createPriorityDomain(definition, labels, true, 0);
	});
};

const createNoOwnerDomain = (labels: DomainLabels, persistent: boolean, count: number): DomainEntry => {
	return {
		key: NO_OWNER_KEY,
		value: '',
		label: labels.noOwner,
		color: undefined,
		persistent,
		count
	};
};

// The filter entries the tasks do not name themselves, built the first time a task needs one and therefore already counting it.
// Anything else is named after the task value it was built from, which is what returning nothing here asks for.
const createPriorityFilterDomain = (domainValue: string, labels: DomainLabels): DomainEntry | undefined => {
	const definition = PRIORITY_DOMAIN_DEFINITIONS.find((priorityDefinition) => {
		return priorityDefinition.value === domainValue;
	});

	return definition ? createPriorityDomain(definition, labels, false, 1) : undefined;
};

const createNoOwnerFilterDomain = (domainValue: string, labels: DomainLabels): DomainEntry | undefined => {
	return domainValue ? undefined : createNoOwnerDomain(labels, false, 1);
};

// The due date and tag filters are the two the form has no list of, so these entries only ever exist as counted filter entries
const createNoDueDateFilterDomain = (domainValue: string, labels: DomainLabels): DomainEntry | undefined => {
	return domainValue ?
		undefined :
		{
			key: NO_DUE_DATE_KEY,
			value: '',
			label: labels.noDueDate,
			color: undefined,
			persistent: false,
			count: 1
		};
};

const createNoTagsFilterDomain = (domainValue: string, labels: DomainLabels): DomainEntry | undefined => {
	return domainValue ?
		undefined :
		{
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
 * The filter lists start empty, because a filter is only offered once a task matches it. The form lists start with the entries
 * they always offer, whatever the tasks look like. Every list is built fresh, so the two sections count their entries on their own.
 * @param labels Wording for the entries the tasks do not name themselves.
 * @returns Default filter and form domains.
 */
export const getInitialDomains = (labels: DomainLabels): DomainsContainer => {
	return {
		filters: {
			priorities: [],
			owners: [],
			dueDates: [],
			tags: []
		},
		form: {
			priorities: createPriorityDomains(labels),
			owners: [ createNoOwnerDomain(labels, true, 0) ],
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
 * Comparator for priority domain entries (by the order the priorities mean, which is not the one their values would sort in).
 * @param entryA First domain entry to compare.
 * @param entryB Second domain entry to compare.
 * @returns The priority sort order.
 */
const domainPriorityCompareFunction = (entryA: DomainEntry, entryB: DomainEntry): number => {
	const indexOf = (entry: DomainEntry): number => {
		return PRIORITY_DOMAIN_DEFINITIONS.findIndex((definition) => {
			return definition.value === entry.value;
		});
	};

	return indexOf(entryA) - indexOf(entryB);
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
	// The filter lists are a checklist the user reads front to back, so they stay in value order. That is what keeps the entries
	// standing for "no value" first, since the empty string sorts before anything a user can type; the priorities are the one
	// list whose values mean an order of their own. The form lists are suggestions the user picks one entry from, so the most
	// used ones come first, with the entry that stands for "no value" kept at the top because it is the default rather than a suggestion.
	domainsContainer.filters.priorities.sort(domainPriorityCompareFunction);
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
 * @param createMissingDomain Builds the entry when the list does not carry it yet, for the values the tasks do not name themselves.
 */
const addDomain = (domainsList: DomainEntry[], newDomainValue: string, createMissingDomain?: (domainValue: string) => DomainEntry | undefined): void => {
	// Find new domain by value
	const domainIndex = domainsList.findIndex((domain) => {
		return domain.value === newDomainValue;
	});

	let domain;
	if(domainIndex === -1) {
		// Create new entry and add it to the list, unless the value is empty and the section has no wording for it
		domain = createMissingDomain?.(newDomainValue);
		if(!domain) {
			if(!newDomainValue) {
				return;
			}

			domain = {
				key: newDomainValue,
				value: newDomainValue,
				label: newDomainValue,
				color: undefined,
				persistent: false,
				count: 1
			};
		}

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
	{ taskField: 'priority', isTaskFieldList: false, domainListField: 'priorities', filtersField: 'priorities', createFilterDomain: createPriorityFilterDomain },
	{ taskField: 'owner', isTaskFieldList: false, domainListField: 'owners', filtersField: 'owners', createFilterDomain: createNoOwnerFilterDomain },
	{ taskField: 'dueDate', isTaskFieldList: false, domainListField: 'dueDates', filtersField: 'dueDates', createFilterDomain: createNoDueDateFilterDomain },
	{ taskField: 'tags', isTaskFieldList: true, domainListField: 'tags', filtersField: 'tags', createFilterDomain: createNoTagsFilterDomain }
];

/**
 * Updates all domains of the given task in the given domains section.
 * If oldTask is empty, the domains are added.
 * If newTask is empty, the domains are removed.
 * @param domainsSection Domain section to update.
 * @param oldTask Previous task values, when present.
 * @param newTask New task values, when present.
 * @param changedTaskValues Task fields that changed.
 * @param filterLabels Wording for the entries the tasks do not name themselves, or nothing for a section that names every entry after a task value.
 */
const updateDomainsForTaskInSection = (domainsSection: DomainsSection, oldTask: Task | undefined, newTask: Task | undefined, changedTaskValues: TaskChange | undefined, filterLabels: DomainLabels | undefined): void => {
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

		// Only the filter section has wording of its own: it is where a priority is named and where "no value" is an entry the
		// user can pick. The form lists name every entry after the task value it was built from, so they get nothing here and
		// an empty value simply never becomes an entry of theirs.
		const createMissingDomain = (domainValue: string): DomainEntry | undefined => {
			return filterLabels ? handler.createFilterDomain(domainValue, filterLabels) : undefined;
		};

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

			// An empty list is a value of its own, counted under the empty domain value like a missing owner or due date is
			if(oldDomainValues && oldDomainValues.length > 0) {
				for(const oldDomainValueElem of oldDomainValues) {
					removeDomain(domainsList, oldDomainValueElem);
				}
			}
			else if(oldDomainValues) {
				removeDomain(domainsList, '');
			}

			if(newDomainValues && newDomainValues.length > 0) {
				for(const newDomainValueElem of newDomainValues) {
					addDomain(domainsList, newDomainValueElem, createMissingDomain);
				}
			}
			else if(newDomainValues) {
				addDomain(domainsList, '', createMissingDomain);
			}
		}

		// If the task value is not a list, simply update the domain list directly.
		else {
			if(oldTask) {
				removeDomain(domainsList, typeof oldDomainValue === 'string' ? oldDomainValue : '');
			}
			if(newTask) {
				addDomain(domainsList, typeof newDomainValue === 'string' ? newDomainValue : '', createMissingDomain);
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
