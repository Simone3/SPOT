
import type { Task, TasksContainer } from 'src/types/TaskTypes';
import type { TaskFilters } from 'src/types/FilterTypes';

/**
 * Returns a new object containing the initial filters.
 * @returns Default task filters.
 */
export const getInitialFilters = (): TaskFilters => {
	return {
		text: '',
		owners: [ ],
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
 * Tests a task's text against the filter text using a case-insensitive substring match.
 * @param taskText Task text to test.
 * @param filterText Filter text to look for.
 * @returns Whether the task text contains the filter text.
 */
const matchesText = (taskText: string, filterText: string): boolean => {
	return taskText.toLowerCase().includes(filterText.toLowerCase());
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

	// A task with no tag at all matches the empty filter value, the "no value" convention the owner and due date filters follow
	// too. A tag the user has started typing but not finished is empty and stands for nothing, so it does not count as a tag.
	if(filters.tags.length > 0) {
		const taskTags = task.tags.filter((tag) => {
			return Boolean(tag);
		});
		const matchesTags = taskTags.length === 0 ?
			filters.tags.includes('') :
			taskTags.some((tag) => {
				return filters.tags.includes(tag);
			});
		if(!matchesTags) {
			return false;
		}
	}

	if(filters.text && !matchesText(task.text, filters.text)) {
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
 * @param cloneTask Callback to clone a task.
 */
const refreshTasksVisibilityHelper = (taskList: Task[], filters: TaskFilters, cloneTask: (task: Task) => Task): void => {
	for(let i = 0; i < taskList.length; i++) {
		const task = taskList[i];
		const newVisibility = matchesFilters(task, filters);
		if(task.visible !== newVisibility) {
			const newTask = cloneTask(task);
			newTask.visible = newVisibility;
			taskList[i] = newTask;
		}
	}
};

/**
 * Refreshes the "visibile" field of all tasks based on the new filters.
 * It clones any changed task.
 * @param tasksContainer Task lists to update.
 * @param oldFilters Previous filter values.
 * @param newFilters New filter values.
 * @param cloneTask Callback to clone a task.
 */
export const refreshTasksVisibility = (tasksContainer: TasksContainer, oldFilters: TaskFilters, newFilters: TaskFilters, cloneTask: (task: Task) => Task): void => {
	// Always refresh active tasks
	refreshTasksVisibilityHelper(tasksContainer.active, newFilters, cloneTask);

	// Refresh completed tasks only if showCompleted is active and/or showCompleted changed just now
	if(newFilters.showCompleted || newFilters.showCompleted !== oldFilters.showCompleted) {
		refreshTasksVisibilityHelper(tasksContainer.completed, newFilters, cloneTask);
	}
};
