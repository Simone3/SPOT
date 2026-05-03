
import type { Task, TaskFilterChange, TaskFilters, TasksContainer } from '../types';

/**
 * Returns a new object containing the initial filters.
 */
export const getInitialFilters = (): TaskFilters => {
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
 * Clones the object and the contained lists.
 */
export const cloneFilters = (filters: TaskFilters): TaskFilters => {
	return {
		text: filters.text,
		owners: [ ...filters.owners ],
		dueDates: [ ...filters.dueDates ],
		priorities: [ ...filters.priorities ],
		tags: [ ...filters.tags ],
		showCompleted: filters.showCompleted
	};
};

/**
 * Checks if a specific tasks matches a set of filters.
 */
const matchesFilters = (task: Task, filters: TaskFilters): boolean => {
	if(task.state === 'COMPLETED' && !filters.showCompleted) {
		return false;
	}

	if(filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
		return false;
	}

	if(filters.owners.length > 0 && !filters.owners.includes(task.owner || '')) {
		return false;
	}

	if(filters.dueDates.length > 0 && !filters.dueDates.includes(task.dueDate || '')) {
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
 * Refreshes the "visibile" field of a task based on the given filters.
 */
export const refreshTaskVisibility = (task: Task, filters: TaskFilters): void => {
	task.visible = matchesFilters(task, filters);
};

/**
 * Helper to refresh the "visibile" field in an array based on the new filters.
 */
const refreshTasksVisibilityHelper = (taskList: Task[], filters: TaskFilters): void => {
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
export const refreshTasksVisibility = (tasksContainer: TasksContainer, oldFilters: TaskFilters, newFilters: TaskFilters | (TaskFilters & TaskFilterChange)): void => {
	// Always refresh active tasks
	refreshTasksVisibilityHelper(tasksContainer.active, newFilters);

	// Refresh completed tasks only if showCompleted is active and/or showCompleted changed just now
	if(newFilters.showCompleted || newFilters.showCompleted !== oldFilters.showCompleted) {
		refreshTasksVisibilityHelper(tasksContainer.completed, newFilters);
	}
};
