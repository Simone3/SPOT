
/**
 * Returns a new object containing the initial filters.
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
const matchesFilters = (task, filters) => {
	if(task.state === 'COMPLETED' && !filters.showCompleted) {
		return false;
	}

	if(filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
		return false;
	}

	if(filters.owners.length > 0 && !filters.owners.includes(task.owner)) {
		return false;
	}

	if(filters.dueDates.length > 0 && !filters.dueDates.includes(task.dueDate)) {
		return false;
	}

	if(filters.tags.length > 0 && (task.tags.length === 0 || task.tags.every((tag) => !filters.tags.includes(tag)))) {
		return false;
	}

	if(filters.text && !new RegExp(filters.text, 'i').test(task.text)) {
		return false;
	}

	return true;
};

/**
 * Refreshes the "visibile" field of a tasks based on the new filters.
 */
export const refreshTaskVisibility = (task, filters) => {
	task.visible = matchesFilters(task, filters);
};

/**
 * Helper to refresh the "visibile" field in an array based on the new filters.
 */
const refreshTaskListsVisibilityHelper = (taskList, filters) => {
	for(let i = 0; i < taskList.length; i++) {
		const task = taskList[i];
		const newVisibility = matchesFilters(task, filters);
		if(task.visible !== newVisibility) {
			taskList[i] = {
				...task,
				visible: newVisibility
			};
		}
	}
};

/**
 * Refreshes the "visibile" field of all tasks based on the new filters.
 * It clones any changed task.
 */
export const refreshTaskListsVisibility = (taskLists, oldFilters, newFilters) => {
	// Always refresh active tasks
	refreshTaskListsVisibilityHelper(taskLists.active, newFilters);

	// Refresh completed tasks only if showCompleted is active and/or showCompleted changed just now
	if(newFilters.showCompleted || newFilters.showCompleted !== oldFilters.showCompleted) {
		refreshTaskListsVisibilityHelper(taskLists.completed, newFilters);
	}
};
