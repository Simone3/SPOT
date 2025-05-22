
const PRIORITIES = [{
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

const NO_OWNER = {
	key: `no-owner-${crypto.randomUUID()}`,
	value: undefined,
	label: 'None (me)',
	color: undefined,
	persistent: true,
	count: 0
};

const NO_DUE_DATE = {
	key: `no-due-date-${crypto.randomUUID()}`,
	value: undefined,
	label: 'None',
	color: undefined,
	persistent: true,
	count: 0
};

/**
 * Returns a new object containing the initial domains.
 */
export const getInitialDomains = () => {
	return {
		filters: {
			priorities: PRIORITIES,
			owners: [ NO_OWNER ],
			dueDates: [ NO_DUE_DATE ],
			tags: []
		},
		form: {
			priorities: PRIORITIES,
			owners: [],
			tags: []
		}
	};
};

/**
 * Clones the object and the contained lists (but not each domain entry).
 */
export const cloneDomains = (domainsContainer) => {
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
 */
const domainCompareFunction = (entryA, entryB) => {
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
 */
const sortAllDomains = (domainsContainer) => {
	// Sort all lists (except priorities, which are already sorted by default)
	domainsContainer.filters.owners.sort(domainCompareFunction);
	domainsContainer.filters.dueDates.sort(domainCompareFunction);
	domainsContainer.filters.tags.sort(domainCompareFunction);
	domainsContainer.form.owners.sort(domainCompareFunction);
	domainsContainer.form.tags.sort(domainCompareFunction);
};

/**
 * Removes a domain value from a domain list (either by removing the entry altogether or by cloning & updating the entry counter).
 */
const removeDomain = (domainsList, oldDomainValue) => {
	// Find old domain by value
	const domainIndex = domainsList.findIndex((domain) => domain.value === oldDomainValue);
	if(domainIndex === -1) {
		return;
	}
	let domain = domainsList[domainIndex];

	if(domain.count <= 1 && !domain.persistent) {
		// Completely remove the entry from the list
		domainsList.splice(domainIndex, 1);
	}
	else {
		// Clone entry, update counters and update the list
		domain = { ...domain };
		domain.count -= 1;
		domainsList[domainIndex] = domain;
	}
};

/**
 * Adds a domain value to a domain list (either by creating a new entry or by cloning & updating an existing entry counter).
 */
const addDomain = (domainsList, newDomainValue) => {
	// Find new domain by value
	const domainIndex = domainsList.findIndex((domain) => domain.value === newDomainValue);

	// Skip new domain value if empty and there's no predefined entry for it
	if(domainIndex === -1 && !newDomainValue) {
		return;
	}

	let domain;
	if(domainIndex === -1) {
		// Create new entry and add it to the list
		domain = {
			key: String(newDomainValue),
			value: newDomainValue,
			label: newDomainValue,
			color: undefined,
			persistent: false,
			count: 1
		};
		domainsList.push(domain);
	}
	else {
		// Clone entry, update counters and update the list
		domain = { ...domainsList[domainIndex] };
		domain.count += 1;
		domainsList[domainIndex] = domain;
	}
};

/**
 * List of dynamic handlers that allow to extract values from tasks and add them to the proper domain lists.
 */
const taskDomainHandlers = [
	{ taskField: 'priority', isTaskFieldList: false, domainListField: 'priorities' },
	{ taskField: 'owner', isTaskFieldList: false, domainListField: 'owners' },
	{ taskField: 'dueDate', isTaskFieldList: false, domainListField: 'dueDates' },
	{ taskField: 'tags', isTaskFieldList: true, domainListField: 'tags' }
];

/**
 * Updates all domains of the given task in the given domains section.
 * If oldTask is empty, the domains are added.
 * If newTask is empty, the domains are removed.
 */
const updateDomainsForTaskInSection = (domainsSection, oldTask, newTask, changedTaskValues) => {
	// Loop all dynamic handlers
	for(const handler of taskDomainHandlers) {
		// Extract the handler's domains list (if present)
		const domainsList = domainsSection[handler.domainListField];
		if(!domainsList) {
			continue;
		}

		// If we have both old and new tasks but the domain value has not changed, no need to do anything
		if(oldTask && newTask && !(handler.taskField in changedTaskValues)) {
			continue;
		}
	
		// Extract the handler's old and/or new values
		const oldDomainValue = oldTask ? oldTask[handler.taskField] : undefined;
		const newDomainValue = newTask ? newTask[handler.taskField] : undefined;

		// If the task value is actually a list, remove all old values and add all new values (for simplicity)
		if(handler.isTaskFieldList) {
			if(oldDomainValue) {
				for(const oldDomainValueElem of oldDomainValue) {
					removeDomain(domainsList, oldDomainValueElem);
				}
			}

			if(newDomainValue) {
				for(const newDomainValueElem of newDomainValue) {
					addDomain(domainsList, newDomainValueElem);
				}
			}
		}

		// If the task value is not a list, simply update the domain list directly (ifs are on the task itself because undefined value may be a valid domain value!)
		else {
			if(oldTask) {
				removeDomain(domainsList, oldDomainValue);
			}
			if(newTask) {
				addDomain(domainsList, newDomainValue);
			}
		}
	}
};

/**
 * Helper to update any changed task domains in their respective domains lists, without sorting.
 * If oldTask is empty, the domains are added.
 * If newTask is empty, the domains are removed.
 */
const updateDomainsForTaskHelper = (domainsContainer, oldTask, newTask, changedTaskValues) => {
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
 */
export const addDomainsForTask = (domainsContainer, task) => {
	updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined);
	sortAllDomains(domainsContainer);
};

/**
 * Removes all domains of a given task from their respective domains lists, keeping them in order.
 */
export const removeDomainsForTask = (domainsContainer, task) => {
	updateDomainsForTaskHelper(domainsContainer, task, undefined, undefined);
	sortAllDomains(domainsContainer);
};

/**
 * Updates any changed task domains in their respective domains lists, keeping them in order.
 */
export const updateDomainsForTask = (domainsContainer, oldTask, newTask, changedTaskValues) => {
	updateDomainsForTaskHelper(domainsContainer, oldTask, newTask, changedTaskValues);
	sortAllDomains(domainsContainer);
};

/**
 * For each task, adds all its domains to their respective domains lists, keeping them in order.
 */
export const addDomainsForTasks = (domainsContainer, tasksContainer) => {
	for(const task of tasksContainer.active) {
		updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined);
	}

	for(const task of tasksContainer.completed) {
		updateDomainsForTaskHelper(domainsContainer, undefined, task, undefined);
	}

	sortAllDomains(domainsContainer);
};
