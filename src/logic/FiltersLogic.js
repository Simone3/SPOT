
/**
 * Returns the initial filters.
 */
export const getInitialFilters = () => {
	return {
		text: '',
		owners: [],
		dueDates: [],
		priorities: [],
		tags: [],
		showCompleted: false
	};
};

/**
 * Checks if a specific tasks matches a set of filters.
 */
export const matchesFilters = (task, filters) => {
	if(task.state === 'COMPLETED' && !filters.showCompleted) {
		return false;
	}

	if(filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
		return false;
	}

	if(filters.owners.length > 0 && !filters.owners.includes(task.priority)) {
		return false;
	}

	if(filters.dueDates.length > 0 && !filters.dueDates.includes(task.priority)) {
		return false;
	}

	if(filters.tags.length > 0 && task.tags.length > 0 && task.tags.every((tag) => !filters.tags.includes(tag))) {
		return false;
	}

	if(filters.text && !new RegExp(filters.text, 'i').test(task.text)) {
		return false;
	}

	return true;
};
