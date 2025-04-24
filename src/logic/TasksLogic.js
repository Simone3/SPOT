import { addAllTaskDomains, sortAllDomainLists, cloneDomainLists } from './DomainsLogic';
import { matchesFilters } from './FiltersLogic';
import { insertIntoManuallySortedList, moveInManuallySortedList } from './ManuallySortedList';

/*
	const task = {
		id: rawTask.id,
		text: rawTask.text,
		state: rawTask.state,
		priority: rawTask.priority,
		owner: rawTask.owner,
		dueDate: rawTask.dueDate,
		tags: [ ...rawTask.tags ],
		completionDate: rawTask.completionDate,
		sortPosition: rawTask.sortPosition,
		visible: undefined
	};

	const DEFAULT_TASK = {
		id: undefined,
		text: undefined,
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: undefined,
		dueDate: undefined,
		tags: []
	};
*/

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
		active: [ taskLists.active ],
		completed: [ taskLists.completed ]
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
 * Adds a new task to the beginning of the completed tasks list (and also sets the completion date to now)
 */
const saveNewCompletedTask = (taskLists, task) => {
	task.completionDate = new Date();
	taskLists.completed.unshift(task);
};

/**
 * Adds a new task to the beginning of the (manually sorted) active tasks list (and also removes any completion date)
 */
const saveNewActiveTask = (taskLists, task) => {
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
		saveNewActiveTask(taskLists, task);
	}
	else {
		saveNewCompletedTask(taskLists, task);
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
 * Helper for "refreshTasksVisibility" to handle both lists in the same way.
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
