
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
 * Adds a domain value to the domains list (either by creating a new entry or by cloning + updating an existing entry counter).
 */
const addDomain = (domainValue, domainList, updateCount, updateActiveCount) => {
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
			count: updateCount,
			activeCount: updateActiveCount
		};
		domainList.push(domain);
	}
	else {
		// Clone domain, update counters and update the list
		domain = { ...domainList[domainIndex] };
		domain.count += updateCount;
		domain.activeCount += updateActiveCount;
		domainList[domainIndex] = domain;
	}
};

/**
 * Removes a domain value from the domains list (either by removing the entry altogether or by cloning + updating the entry counter).
 */
const removeDomain = (domainValue, domainList, updateCount, updateActiveCount) => {
	// Set falsey values to undefined
	if(!domainValue) {
		domainValue = undefined;
	}

	// Find domain by value
	const domainIndex = domainList.findIndex((domain) => domain.value === domainValue);

	if(domainIndex !== -1) {
		let domain = domainList[domainIndex];

		if(domain.count - updateCount <= 0 && !domain.persistent) {
			// Completely remove the domain from the list
			domainList.splice(domainIndex, 1);
		}
		else {
			// Clone domain, update counters and update the list
			domain = { ...domain };
			domain.count -= updateCount;
			domain.activeCount -= updateActiveCount;
			domainList[domainIndex] = domain;
		}
	}
};

/**
 * Helper that calls "action" for each of the task domains.
 */
const doForAllDomains = (task, action, domainLists) => {
	const updateCount = 1;
	const updateActiveCount = task.state === 'ACTIVE' ? 1 : 0;
	action(task.priority, domainLists.priorities, updateCount, updateActiveCount);
	action(task.owner, domainLists.owners, updateCount, updateActiveCount);
	action(task.dueDate, domainLists.dueDates, updateCount, updateActiveCount);
	for(const tag of task.tags) {
		if(tag) {
			action(tag, domainLists.tags, updateCount, updateActiveCount);
		}
	}
};

/**
 * Adds all task domains to their respective domains lists.
 */
export const addAllTaskDomains = (task, domainLists) => {
	doForAllDomains(task, addDomain, domainLists);
};

/**
 * Removes all task domains from their respective domains lists.
 */
export const removeAllDomains = (task, domainLists) => {
	doForAllDomains(task, removeDomain, domainLists);
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
export const sortAllDomainLists = (domainLists) => {
	// Sort all lists (except priorities, which are already sorted by default)
	domainLists.owners.sort(domainCompareFunction);
	domainLists.dueDates.sort(domainCompareFunction);
	domainLists.tags.sort(domainCompareFunction);
};
