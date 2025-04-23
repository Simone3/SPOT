
/**
 * Adds a domain value to the domains list (either by creating a new entry or by cloning + updating an existing entry counter).
 * Does nothing for an empty domain value.
 */
const addDomain = (domainValue, domainList, updateCount, updateActiveCount) => {
	if(domainValue) {
		// Find domain by ID
		const domainId = domainValue.toLowerCase();
		const domainIndex = domainList.findIndex((value) => value.id === domainId);

		let domain;
		if(domainIndex === -1) {
			// Create new domain and add it to the list
			domain = {
				id: domainId,
				label: domainValue,
				count: 0,
				activeCount: 0
			};
			domainList.push(domain);
		}
		else {
			// Clone domain and update the list
			domain = { ...domainList[domainIndex] };
			domainList[domainIndex] = domain;
		}

		// Update counters
		domain.count += updateCount;
		domain.activeCount += updateActiveCount;
	}
};

/**
 * Removes a domain value from the domains list (either by removing the entry altogether or by cloning + updating the entry counter).
 * Does nothing for an empty domain value.
 */
const removeDomain = (domainValue, domainList, updateCount, updateActiveCount) => {
	if(domainValue) {
		// Find domain by ID
		const domainId = domainValue.toLowerCase();
		const domainIndex = domainList.findIndex((value) => value.id === domainId);

		if(domainIndex !== -1) {
			let domain = domainList[domainIndex];

			if(domain.count - updateCount <= 0) {
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
		action(tag, domainLists.tags, updateCount, updateActiveCount);
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
 * Returns the initial domains.
 */
export const getInitialDomainLists = () => {
	const priorities = [];
	addDomain('URGENT', priorities, 0, 0);
	addDomain('HIGH', priorities, 0, 0);
	addDomain('MEDIUM', priorities, 0, 0);
	addDomain('LOW', priorities, 0, 0);

	return {
		priorities: priorities,
		owners: [],
		dueDates: [],
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
 * Comparator for domains (sort by ID).
 */
const domainCompareFunction = (domainA, domainB) => {
	if(domainA.id < domainB.id) {
		return -1;
	}
	if(domainA.id > domainB.id) {
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
