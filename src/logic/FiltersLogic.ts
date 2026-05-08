
import type { Task, TasksContainer } from 'src/types/TaskTypes';
import type { TaskFilterChange, TaskFilters } from 'src/types/FilterTypes';

/**
 * Returns a new object containing the initial filters.
 * @returns Default task filters.
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
 * @param filters Filters to clone.
 * @returns A shallow clone of the filters.
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
 * @param task Task to test.
 * @param filters Filters to apply.
 * @returns Whether the task matches.
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

	if(filters.tags.length > 0 && (task.tags.length === 0 || task.tags.every((tag) => {
		return !filters.tags.includes(tag);
	}))) {
		return false;
	}

	if(filters.text && !new RegExp(filters.text, 'i').test(task.text)) {
		return false;
	}

	return true;
};

/**
 * Refreshes the "visibile" field of a task based on the given filters.
 * @param task Task to update.
 * @param filters Filters controlling visibility.
 */
export const refreshTaskVisibility = (task: Task, filters: TaskFilters): void => {
	task.visible = matchesFilters(task, filters);
};

/**
 * Helper to refresh the "visibile" field in an array based on the new filters.
 * @param taskList Task list to update.
 * @param filters Filters controlling visibility.
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
 * @param tasksContainer Task lists to update.
 * @param oldFilters Previous filter values.
 * @param newFilters New filter values.
 */
export const refreshTasksVisibility = (tasksContainer: TasksContainer, oldFilters: TaskFilters, newFilters: TaskFilters | (TaskFilters & TaskFilterChange)): void => {
	// Always refresh active tasks
	refreshTasksVisibilityHelper(tasksContainer.active, newFilters);

	// Refresh completed tasks only if showCompleted is active and/or showCompleted changed just now
	if(newFilters.showCompleted || newFilters.showCompleted !== oldFilters.showCompleted) {
		refreshTasksVisibilityHelper(tasksContainer.completed, newFilters);
	}
};
