
/**
 * Adds a domain value to the domains list (either by creating a new entry or by updating an existing entry counter).
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
			// Clone domain (state) and update the list
			domain = { ...domainList[domainIndex] };
			domainList[domainIndex] = domain;
		}

		// Update counters
		domain.count += updateCount;
		domain.activeCount += updateActiveCount;
	}
};

/**
 * Removes a domain value from the domains list (either by removing the entry altogether or by updating the entry counter).
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
				// Clone domain (state), update counters and update the list
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
const doForAllDomains = (task, action, domains) => {
	const updateCount = 1;
	const updateActiveCount = task.state === 'ACTIVE' ? 1 : 0;
	action(task.priority, domains.priorities, updateCount, updateActiveCount);
	action(task.owner, domains.owners, updateCount, updateActiveCount);
	action(task.dueDate, domains.dueDates, updateCount, updateActiveCount);
	for(const tag of task.tags) {
		action(tag, domains.tags, updateCount, updateActiveCount);
	}
};

/**
 * Adds all task domains to their respective domains lists.
 */
export const addAllDomains = (task, domains) => {
	doForAllDomains(task, addDomain, domains);
};

/**
 * Removes all task domains from their respective domains lists.
 */
export const removeAllDomains = (task, domains) => {
	doForAllDomains(task, removeDomain, domains);
};

/**
 * Returns the initial domains
 */
export const getInitialDomains = () => {
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
export const cloneDomains = (domains) => {
	return {
		priorities: [ ...domains.priorities ],
		owners: [ ...domains.owners ],
		dueDates: [ ...domains.dueDates ],
		tags: [ ...domains.tags ]
	};
};

/**
 * Sort callback for domains.
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
export const sortAllDomains = (domains) => {
	// Sort all lists (except priorities, which are already sorted by default)
	domains.owners.sort(domainCompareFunction);
	domains.dueDates.sort(domainCompareFunction);
	domains.tags.sort(domainCompareFunction);
};
