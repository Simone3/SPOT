
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
	createDomain: (domainValue: string) => DomainEntry;
};

// Whether a section offers an entry standing for "no value" — no owner, no due date, no tag at all. The filter section does,
// because a task with nothing there is a task the user filters for; the form lists are the values to type into an input, and
// "no value" is not one of them. This only decides whether such an entry is created: a section already carrying one, the way
// the form owners always offer "Me", counts it either way.
const FILTERS_OFFER_EMPTY_VALUE_DOMAINS = true;
const FORM_OFFERS_EMPTY_VALUE_DOMAINS = false;

// The keys of the entries that stand for "no value" are random, so they can never collide with an owner, a due date or a tag a
// user typed. They are generated once, so that rebuilding the domains keeps React rendering the same elements.
const NO_OWNER_KEY = `no-owner-${crypto.randomUUID()}`;
const NO_DUE_DATE_KEY = `no-due-date-${crypto.randomUUID()}`;
const NO_TAGS_KEY = `no-tags-${crypto.randomUUID()}`;

// The priorities, in the order they mean rather than the one their values would sort in. The key doubles as the colour suffix,
// so a priority looks the same wherever it is built.
const PRIORITY_DOMAIN_DEFINITIONS: PriorityDomainDefinition[] = [
	{ value: 'URGENT', key: 'urgent' },
	{ value: 'HIGH', key: 'high' },
	{ value: 'NORMAL', key: 'normal' },
	{ value: 'LOW', key: 'low' }
];

// An entry named after the task value it was built from, which is what every entry the tasks spell out themselves is
const createValueDomain = (domainValue: string): DomainEntry => {
	return {
		key: domainValue,
		value: domainValue,
		labelKind: 'VALUE',
		color: undefined,
		persistent: false,
		count: 1
	};
};

const createPriorityDomain = (definition: PriorityDomainDefinition, persistent: boolean, count: number): DomainEntry => {
	return {
		key: definition.key,
		value: definition.value,
		labelKind: 'PRIORITY',
		color: `var(--colors-priority-${definition.key})`,
		persistent,
		count
	};
};

const createPriorityDomains = (): DomainEntry[] => {
	return PRIORITY_DOMAIN_DEFINITIONS.map((definition) => {
		return createPriorityDomain(definition, true, 0);
	});
};

const createNoOwnerDomain = (persistent: boolean, count: number): DomainEntry => {
	return {
		key: NO_OWNER_KEY,
		value: '',
		labelKind: 'NO_OWNER',
		color: undefined,
		persistent,
		count
	};
};

// What each handler builds when its list does not carry a value yet. An entry created on demand always counts the task that
// called for it and is never persistent: only the entries a section offers up front are.
const createPriorityDomainForValue = (domainValue: string): DomainEntry => {
	const definition = PRIORITY_DOMAIN_DEFINITIONS.find((priorityDefinition) => {
		return priorityDefinition.value === domainValue;
	});

	return definition ? createPriorityDomain(definition, false, 1) : createValueDomain(domainValue);
};

const createOwnerDomainForValue = (domainValue: string): DomainEntry => {
	return domainValue ? createValueDomain(domainValue) : createNoOwnerDomain(false, 1);
};

const createDueDateDomainForValue = (domainValue: string): DomainEntry => {
	return domainValue ?
		createValueDomain(domainValue) :
		{
			key: NO_DUE_DATE_KEY,
			value: '',
			labelKind: 'NO_DUE_DATE',
			color: undefined,
			persistent: false,
			count: 1
		};
};

const createTagDomainForValue = (domainValue: string): DomainEntry => {
	return domainValue ?
		createValueDomain(domainValue) :
		{
			key: NO_TAGS_KEY,
			value: '',
			labelKind: 'NO_TAGS',
			color: undefined,
			persistent: false,
			count: 1
		};
};

/**
 * Returns a new object containing the initial domains.
 * The filter lists start empty, because a filter is only offered once a task matches it. The form lists start with the entries
 * they always offer, whatever the tasks look like. Every list is built fresh, so the two sections count their entries on their own.
 * @returns Default filter and form domains.
 */
export const getInitialDomains = (): DomainsContainer => {
	return {
		filters: {
			priorities: [],
			owners: [],
			dueDates: [],
			tags: []
		},
		form: {
			priorities: createPriorityDomains(),
			owners: [ createNoOwnerDomain(true, 0) ],
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
 * @param createDomain Builds the entry when the list does not carry the value yet.
 * @param offersEmptyValueDomains Whether the section this list belongs to offers an entry standing for "no value".
 */
const addDomain = (domainsList: DomainEntry[], newDomainValue: string, createDomain: (domainValue: string) => DomainEntry, offersEmptyValueDomains: boolean): void => {
	// Find new domain by value
	const domainIndex = domainsList.findIndex((domain) => {
		return domain.value === newDomainValue;
	});

	// Skip new domain value if empty and the section has no entry standing for it
	if(domainIndex === -1 && !newDomainValue && !offersEmptyValueDomains) {
		return;
	}

	let domain;
	if(domainIndex === -1) {
		// Create new entry and add it to the list
		domain = createDomain(newDomainValue);
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
	{ taskField: 'priority', isTaskFieldList: false, domainListField: 'priorities', filtersField: 'priorities', createDomain: createPriorityDomainForValue },
	{ taskField: 'owner', isTaskFieldList: false, domainListField: 'owners', filtersField: 'owners', createDomain: createOwnerDomainForValue },
	{ taskField: 'dueDate', isTaskFieldList: false, domainListField: 'dueDates', filtersField: 'dueDates', createDomain: createDueDateDomainForValue },
	{ taskField: 'tags', isTaskFieldList: true, domainListField: 'tags', filtersField: 'tags', createDomain: createTagDomainForValue }
];

/**
 * Updates all domains of the given task in the given domains section.
 * If oldTask is empty, the domains are added.
 * If newTask is empty, the domains are removed.
 * @param domainsSection Domain section to update.
 * @param oldTask Previous task values, when present.
 * @param newTask New task values, when present.
 * @param changedTaskValues Task fields that changed.
 * @param offersEmptyValueDomains Whether this section offers an entry standing for "no value".
 */
const updateDomainsForTaskInSection = (domainsSection: DomainsSection, oldTask: Task | undefined, newTask: Task | undefined, changedTaskValues: TaskChange | undefined, offersEmptyValueDomains: boolean): void => {
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
					addDomain(domainsList, newDomainValueElem, handler.createDomain, offersEmptyValueDomains);
				}
			}
			else if(newDomainValues) {
				addDomain(domainsList, '', handler.createDomain, offersEmptyValueDomains);
			}
		}

		// If the task value is not a list, simply update the domain list directly.
		else {
			if(oldTask) {
				removeDomain(domainsList, typeof oldDomainValue === 'string' ? oldDomainValue : '');
			}
			if(newTask) {
				addDomain(domainsList, typeof newDomainValue === 'string' ? newDomainValue : '', handler.createDomain, offersEmptyValueDomains);
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
	updateDomainsForTaskInSection(domainsContainer.form, oldTask, newTask, changedTaskValues, FORM_OFFERS_EMPTY_VALUE_DOMAINS);

	// Update the filters section (it contains domains for the active tasks only)
	if(newTask && oldTask) {
		const oldActive = oldTask.state === 'ACTIVE';
		const newActive = newTask.state === 'ACTIVE';
		if(oldActive && !newActive) {
			// Task changes state to completed: remove the domains from filters section
			updateDomainsForTaskInSection(domainsContainer.filters, oldTask, undefined, undefined, FILTERS_OFFER_EMPTY_VALUE_DOMAINS);
		}
		else if(!oldActive && newActive) {
			// Task changes state to active: add the domains to filters section
			updateDomainsForTaskInSection(domainsContainer.filters, undefined, newTask, undefined, FILTERS_OFFER_EMPTY_VALUE_DOMAINS);
		}
		else if(oldActive && newActive) {
			// Task remains active: update the filters section
			updateDomainsForTaskInSection(domainsContainer.filters, oldTask, newTask, changedTaskValues, FILTERS_OFFER_EMPTY_VALUE_DOMAINS);
		}
	}
	else if((oldTask && oldTask.state === 'ACTIVE') || (newTask && newTask.state === 'ACTIVE')) {
		// Add or remove active task: update the filters section
		updateDomainsForTaskInSection(domainsContainer.filters, oldTask, newTask, changedTaskValues, FILTERS_OFFER_EMPTY_VALUE_DOMAINS);
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
