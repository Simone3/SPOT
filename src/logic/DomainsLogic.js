
/**
 * Returns a new object containing the initial domains.
 */
export const getInitialDomainLists = () => {
	return {
		priorities: [{
			key: 'urgent',
			value: 'URGENT',
			label: 'Urgent',
			color: 'var(--colors-priority-urgent)',
			persistent: true,
			count: 0,
			activeCount: 0
		}, {
			key: 'high',
			value: 'HIGH',
			label: 'High',
			color: 'var(--colors-priority-high)',
			persistent: true,
			count: 0,
			activeCount: 0
		}, {
			key: 'normal',
			value: 'NORMAL',
			label: 'Normal',
			color: 'var(--colors-priority-normal)',
			persistent: true,
			count: 0,
			activeCount: 0
		}, {
			key: 'low',
			value: 'LOW',
			label: 'Low',
			color: 'var(--colors-priority-low)',
			persistent: true,
			count: 0,
			activeCount: 0
		}],
		owners: [{
			key: `no-owner-${crypto.randomUUID()}`,
			value: undefined,
			label: 'None (me)',
			color: undefined,
			persistent: true,
			count: 0,
			activeCount: 0
		}],
		dueDates: [{
			key: `no-due-date-${crypto.randomUUID()}`,
			value: undefined,
			label: 'None',
			color: undefined,
			persistent: true,
			count: 0,
			activeCount: 0
		}],
		tags: []
	};
};

/**
 * Clones the object and the contained lists (but not each domain entry).
 */
export const cloneDomainLists = (domainLists) => {
	return {
		priorities: [ ...domainLists.priorities ],
		owners: [ ...domainLists.owners ],
		dueDates: [ ...domainLists.dueDates ],
		tags: [ ...domainLists.tags ]
	};
};

/**
 * Comparator for domains (sort by value).
 */
const domainCompareFunction = (domainA, domainB) => {
	if(domainA.value < domainB.value) {
		return -1;
	}
	if(domainA.value > domainB.value) {
		return 1;
	}
	return 0;
};

/**
 * Sorts all domains lists.
 */
const sortAllDomainLists = (domainLists) => {
	// Sort all lists (except priorities, which are already sorted by default)
	domainLists.owners.sort(domainCompareFunction);
	domainLists.dueDates.sort(domainCompareFunction);
	domainLists.tags.sort(domainCompareFunction);
};

/**
 * Adds a domain value to the domains list (either by creating a new entry or by cloning + updating an existing entry counter).
 */
const addDomain = (domainList, domainValue, isActive) => {
	// Set falsey values to undefined
	if(!domainValue) {
		domainValue = undefined;
	}

	// Find domain by value
	const domainIndex = domainList.findIndex((domain) => domain.value === domainValue);

	// Skip empty domain value if there's no predefined domain value for it
	if(domainIndex === -1 && !domainValue) {
		return;
	}

	let domain;
	if(domainIndex === -1) {
		// Create new domain and add it to the list
		domain = {
			key: String(domainValue),
			value: domainValue,
			label: domainValue,
			color: undefined,
			persistent: false,
			count: 1,
			activeCount: isActive ? 1 : 0
		};
		domainList.push(domain);
	}
	else {
		// Clone domain, update counters and update the list
		domain = { ...domainList[domainIndex] };
		domain.count += 1;
		if(isActive) {
			domain.activeCount += 1;
		}
		domainList[domainIndex] = domain;
	}
};

/**
 * Removes a domain value from the domains list (either by removing the entry altogether or by cloning + updating the entry counter).
 */
const removeDomain = (domainList, domainValue, isActive) => {
	// Set falsey values to undefined
	if(!domainValue) {
		domainValue = undefined;
	}

	// Find domain by value
	const domainIndex = domainList.findIndex((domain) => domain.value === domainValue);
	if(domainIndex === -1) {
		return;
	}
	let domain = domainList[domainIndex];

	if(domain.count <= 1 && !domain.persistent) {
		// Completely remove the domain from the list
		domainList.splice(domainIndex, 1);
	}
	else {
		// Clone domain, update counters and update the list
		domain = { ...domain };
		domain.count -= 1;
		if(isActive) {
			domain.activeCount -= 1;
		}
		domainList[domainIndex] = domain;
	}
};

/**
 * List of dynamic handlers that allow to extract values from tasks and add them to the proper domain lists.
 */
const taskDomainHandlers = [
	{ taskField: 'priority', domainListField: 'priorities', isList: false },
	{ taskField: 'owner', domainListField: 'owners', isList: false },
	{ taskField: 'dueDate', domainListField: 'dueDates', isList: false },
	{ taskField: 'tags', domainListField: 'tags', isList: true }
];

/**
 * Helper to add task domains.
 */
const addDomainsForTaskWithoutSorting = (domainLists, task) => {
	const isActive = task.state === 'ACTIVE';

	for(const handler of taskDomainHandlers) {
		const domainValue = task[handler.taskField];
		const domainList = domainLists[handler.domainListField];
		if(handler.isList) {
			if(domainValue) {
				for(const domainValueElement of domainValue) {
					addDomain(domainList, domainValueElement, isActive);
				}
			}
		}
		else {
			addDomain(domainList, domainValue, isActive);
		}
	}
};

/**
 * Adds all task domains to their respective domains lists.
 */
export const addDomainsForTask = (domainLists, task) => {
	addDomainsForTaskWithoutSorting(domainLists, task);
	sortAllDomainLists(domainLists);
};

/**
 * For each task in the lists, adds all task domains to their respective domains lists.
 */
export const addDomainsForTaskLists = (domainLists, taskLists) => {
	for(const task of taskLists.active) {
		addDomainsForTaskWithoutSorting(domainLists, task);
	}

	for(const task of taskLists.completed) {
		addDomainsForTaskWithoutSorting(domainLists, task);
	}

	sortAllDomainLists(domainLists);
};

/**
 * Removes all task domains from their respective domains lists.
 */
export const removeDomainsForTask = (domainLists, task) => {
	const isActive = task.state === 'ACTIVE';

	for(const handler of taskDomainHandlers) {
		const domainValue = task[handler.taskField];
		const domainList = domainLists[handler.domainListField];
		if(handler.isList) {
			if(domainValue) {
				for(const domainValueElement of domainValue) {
					removeDomain(domainList, domainValueElement, isActive);
				}
			}
		}
		else {
			removeDomain(domainList, domainValue, isActive);
		}
	}

	sortAllDomainLists(domainLists);
};

/**
 * Updates any changed task domains in their respective domains lists.
 * Returns true if domains actually changed.
 */
export const updateDomainsForTask = (domainLists, oldTask, newTask, changedTaskValues) => {
	const isStateChanged = oldTask.state !== newTask.state;
	const isOldActive = oldTask.state === 'ACTIVE';
	const isNewActive = newTask.state === 'ACTIVE';

	for(const handler of taskDomainHandlers) {
		// Do something only if the state changed (i.e. all domains need to update the active count) or the domain value actually changed
		if(isStateChanged || handler.taskField in changedTaskValues) {
			const oldDomainValue = oldTask[handler.taskField];
			const newDomainValue = newTask[handler.taskField];
			const domainList = domainLists[handler.domainListField];
			if(handler.isList) {
				if(oldDomainValue) {
					for(const domainValueElement of oldDomainValue) {
						removeDomain(domainList, domainValueElement, isOldActive);
					}
				}
				if(newDomainValue) {
					for(const domainValueElement of newDomainValue) {
						addDomain(domainList, domainValueElement, isNewActive);
					}
				}
			}
			else {
				removeDomain(domainList, oldDomainValue, isOldActive);
				addDomain(domainList, newDomainValue, isNewActive);
			}
		}
	}

	sortAllDomainLists(domainLists);
};
