import { addAllTaskDomains, sortAllDomainLists, cloneDomainLists } from './DomainsLogic';
import { matchesFilters } from './FiltersLogic';
import { insertIntoManuallySortedList } from './ManuallySortedList';

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

const saveNewCompletedTask = (taskLists, task) => {
	task.completionDate = new Date();
	taskLists.completed.unshift(task);
};

const saveNewActiveTask = (taskLists, task) => {
	task.completionDate = undefined;
	insertIntoManuallySortedList(taskLists.active, task, 0);
};

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

	// set sort position

	// add to one of the two task lists (clone)

	// add all domains

	// re-sort tasks
	// if domains changed, re-sort domains
};

export const moveActiveTask = (taskLists, fromIndex, toIndex) => {

};
