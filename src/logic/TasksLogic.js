import { addAllTaskDomains, sortAllDomainLists, removeAllDomains } from './DomainsLogic';
import { matchesFilters } from './FiltersLogic';
import { insertIntoManuallySortedList, moveInManuallySortedList } from './ManuallySortedList';

/**
 * Returns the initial task lists.
 */
export const getInitialTaskLists = () => {
	return {
		active: [],
		completed: []
	};
};

/**
 * Clones the object and the contained lists (but not each task).
 */
export const cloneTaskLists = (taskLists) => {
	return {
		active: [ ...taskLists.active ],
		completed: [ ...taskLists.completed ]
	};
};

/**
 * Comparator for active tasks (sort by position and then by ID).
 */
const activeTasksCompareFunction = (taskA, taskB) => {
	const position = taskA.sortPosition - taskB.sortPosition;
	if(position !== 0) {
		return position;
	}
	if(taskA.id < taskB.id) {
		return -1;
	}
	if(taskA.id > taskB.id) {
		return 1;
	}
	return 0;
};

/**
 * Comparator for completed tasks (sort by completion date and then by ID).
 */
const completedTasksCompareFunction = (taskA, taskB) => {
	const completion = taskA.completionDate - taskB.completionDate;
	if(completion !== 0) {
		return completion;
	}
	if(taskA.id < taskB.id) {
		return -1;
	}
	if(taskA.id > taskB.id) {
		return 1;
	}
	return 0;
};

/**
 * Sorts all task lists.
 */
const sortAllTaskLists = (taskLists) => {
	taskLists.active.sort(activeTasksCompareFunction);
	taskLists.completed.sort(completedTasksCompareFunction);
};

/**
 * Adds a list of back-end tasks into the task and domain lists.
 */
export const loadBackEndTasks = (backEndTasks, taskLists, domainLists, filters) => {
	for(const task of backEndTasks) {
		task.visible = matchesFilters(task, filters);
		if(task.state === 'ACTIVE') {
			taskLists.active.push(task);
		}
		else {
			taskLists.completed.push(task);
		}
		addAllTaskDomains(task, domainLists);
	}

	sortAllTaskLists(taskLists);
	sortAllDomainLists(domainLists);
};

/**
 * Adds a task to the beginning of the completed tasks list (and also sets the completion date to now).
 */
const insertCompletedTask = (taskLists, task) => {
	task.completionDate = new Date();
	taskLists.completed.unshift(task);
};

/**
 * Adds a task to the beginning of the (manually sorted) active tasks list (and also removes any completion date).
 */
const insertActiveTask = (taskLists, task) => {
	task.completionDate = undefined;
	insertIntoManuallySortedList(taskLists.active, task, 0);
};

/**
 * Adds a new task to the proper tasks lists.
 * It also sets some task fields: id, visible, completionDate, sortPosition.
 * It also adds any domain to the domains lists and re-sorts them.
 */
export const saveNewTask = (task, taskLists, domainLists, filters) => {
	task.id = crypto.randomUUID();
	task.visible = matchesFilters(task, filters);

	if(task.state === 'ACTIVE') {
		insertActiveTask(taskLists, task);
	}
	else {
		insertCompletedTask(taskLists, task);
	}

	addAllTaskDomains(task, domainLists);
	sortAllDomainLists(domainLists);
};

/**
 * Moves an active task at position "fromIndex" to position "toIndex" (i.e. it will be placed in the position BEFORE the current "toIndex" element).
 * It also updates the "sortPosition" field in the moved task.
 * It may recompute the "sortPosition" fields of other tasks if space needs to be made.
 */
export const moveActiveTask = (taskLists, fromIndex, toIndex) => {
	moveInManuallySortedList(taskLists.active, fromIndex, toIndex);
};

/**
 * Helper to refresh the "visibile" field in an array based on the new filters.
 */
const refreshTasksVisibilityHelper = (taskList, filters) => {
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
export const refreshTasksVisibility = (taskLists, oldFilters, newFilters) => {
	// Always refresh active tasks
	refreshTasksVisibilityHelper(taskLists.active, newFilters);

	// Refresh completed tasks only if showCompleted is active and/or showCompleted changed just now
	if(newFilters.showCompleted || newFilters.showCompleted !== oldFilters.showCompleted) {
		refreshTasksVisibilityHelper(taskLists.completed, newFilters);
	}
};

/**
 * Helper to remove a task from an array.
 */
const removeTaskFromList = (taskList, task) => {
	const index = taskList.findIndex((arrayTask) => task.id === arrayTask.id);
	if(index === -1) {
		throw Error(`Task ${task.id} does not exist, cannot remove from list!`);
	}
	taskList.splice(index);
};

/**
 * Removes a task from its task list.
 * It also removes any domain from the domains lists and re-sorts them.
 */
export const deleteTask = (taskLists, domainLists, task) => {
	if(task.state === 'ACTIVE') {
		removeTaskFromList(taskLists.active, task);
	}
	else {
		removeTaskFromList(taskLists.completed, task);
	}

	removeAllDomains(task, domainLists);
	sortAllDomainLists(domainLists);
};

export const updateTask = (taskLists, domainLists, filters, oldTask, changedValues) => {
	const newTask = {
		...oldTask,
		...changedValues
	};
	newTask.visible = matchesFilters(newTask, filters);

	// If state changes, move the task from one list to the other (and set/reset the completion date)
	if(oldTask.state !== newTask.state) {
		if(oldTask.state === 'ACTIVE') {
			removeTaskFromList(taskLists.active, oldTask);
			insertCompletedTask(taskLists, newTask);
		}
		else {
			removeTaskFromList(taskLists.completed, oldTask);
			insertActiveTask(taskLists, newTask);
		}
	}

	// Refresh domains (this can be implemented more efficiently but good enough for now...)
	removeAllDomains(oldTask, domainLists);
	addAllTaskDomains(newTask, domainLists);
	sortAllDomainLists(domainLists);
};
