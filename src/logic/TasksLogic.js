import { insertIntoManuallySortedList, moveInManuallySortedList, recomputeSortPositions } from './ManuallySortedList';

const PRIORITIES_SORT = {
	LOW: 0,
	NORMAL: 1,
	HIGH: 2,
	URGENT: 3
};

/**
 * Returns a new object containing the initial task lists.
 */
export const getInitialTasks = () => {
	return {
		active: [],
		completed: []
	};
};

/**
 * Clones the object and the contained lists (but not each task).
 */
export const cloneTasks = (tasksContainer) => {
	return {
		active: [ ...tasksContainer.active ],
		completed: [ ...tasksContainer.completed ]
	};
};

/**
 * Default comparator (by ID)
 */
const taskIdCompareFunction = (taskA, taskB) => {
	if(taskA.id < taskB.id) {
		return -1;
	}
	if(taskA.id > taskB.id) {
		return 1;
	}
	return 0;
};

/**
 * Comparator for active tasks (sort by position and then by ID).
 */
const activeTasksPositionCompareFunction = (taskA, taskB) => {
	const positionCompare = taskA.sortPosition - taskB.sortPosition;
	if(positionCompare !== 0) {
		return positionCompare;
	}
	return taskIdCompareFunction(taskA, taskB);
};

/**
 * Comparator for refreshing active tasks positions (sort by priority DESC, then due date DESC and then default to original manual sort).
 */
const activeTasksImportanceCompareFunction = (taskA, taskB) => {
	const priorityCompare = PRIORITIES_SORT[taskB.priority] - PRIORITIES_SORT[taskA.priority];
	if(priorityCompare !== 0) {
		return priorityCompare;
	}

	let dueDateCompare = 0;
	if(taskA.dueDate && taskB.dueDate) {
		// Due date DESC if both tasks have it
		dueDateCompare = taskB.dueDate - taskA.dueDate;
	}
	else if(taskA.dueDate) {
		// If only task A has a due date, it goes first
		dueDateCompare = -1;
	}
	else if(taskB.dueDate) {
		// If only task B has a due date, it goes first
		dueDateCompare = 1;
	}
	if(dueDateCompare !== 0) {
		return dueDateCompare;
	}

	// Keep original manual sort if all values are the same
	return taskA.sortPosition - taskB.sortPosition;
};

/**
 * Comparator for completed tasks (sort by completion date DESC and then by ID).
 */
const completedTasksCompareFunction = (taskA, taskB) => {
	const completionCompare = taskB.completionDate - taskA.completionDate;
	if(completionCompare !== 0) {
		return completionCompare;
	}
	return taskIdCompareFunction(taskA, taskB);
};

/**
 * Sorts all task lists.
 */
const sortAllTasks = (tasksContainer) => {
	tasksContainer.active.sort(activeTasksPositionCompareFunction);
	tasksContainer.completed.sort(completedTasksCompareFunction);
};

/**
 * Re-computes the sorting of active tasks by importance (priority / due date), possibly overriding the existing manual sort.
 */
export const forceSortActiveTasksByImportance = (tasksContainer) => {
	// Re-sort the whole list based on importance rules
	tasksContainer.active.sort(activeTasksImportanceCompareFunction);

	// Re-compute sort positions where needed
	recomputeSortPositions(tasksContainer.active);
};

/**
 * Adds a list of back-end tasks into the task lists.
 */
export const loadBackEndTasks = (tasksContainer, backEndTasks) => {
	for(const task of backEndTasks) {
		if(task.state === 'ACTIVE') {
			tasksContainer.active.push(task);
		}
		else {
			tasksContainer.completed.push(task);
		}
	}

	sortAllTasks(tasksContainer);
};

/**
 * Adds a task to the beginning of the completed tasks list (and also sets the completion date to now).
 */
const insertCompletedTask = (tasksContainer, task) => {
	task.completionDate = new Date();
	tasksContainer.completed.unshift(task);
};

/**
 * Adds a task to the beginning of the (manually sorted) active tasks list (and also removes any completion date).
 */
const insertActiveTask = (tasksContainer, task) => {
	task.completionDate = undefined;
	insertIntoManuallySortedList(tasksContainer.active, task, 0);
};

/**
 * Adds a new "empty" task to the proper tasks lists and returns it.
 */
export const addNewTask = (tasksContainer) => {
	const newTask = {
		id: crypto.randomUUID(),
		text: '',
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: undefined,
		dueDate: undefined,
		tags: [],
		sortPosition: undefined,
		visible: false,
		completionDate: undefined
	};

	insertActiveTask(tasksContainer, newTask);

	return newTask;
};

/**
 * Moves an active task at position "fromIndex" to position "toIndex" (i.e. it will be placed in the position BEFORE the current "toIndex" element).
 * It also updates the "sortPosition" field in the moved task.
 * It may recompute the "sortPosition" fields of other tasks if space needs to be made.
 */
export const moveActiveTask = (tasksContainer, fromIndex, toIndex) => {
	moveInManuallySortedList(tasksContainer.active, fromIndex, toIndex);
};

/**
 * Helper to remove a task from an array.
 */
const removeTaskFromList = (taskList, task) => {
	const index = taskList.findIndex((arrayTask) => task.id === arrayTask.id);
	if(index !== -1) {
		taskList.splice(index, 1);
	}
};

/**
 * Helper to replace a task from an array.
 */
const replaceTaskInList = (taskList, oldTask, newTask) => {
	const index = taskList.findIndex((arrayTask) => oldTask.id === arrayTask.id);
	if(index !== -1) {
		taskList[index] = newTask;
	}
};

/**
 * Removes a task from its task list.
 */
export const deleteTask = (tasksContainer, task) => {
	if(task.state === 'ACTIVE') {
		removeTaskFromList(tasksContainer.active, task);
	}
	else {
		removeTaskFromList(tasksContainer.completed, task);
	}
};

/**
 * Updates a task.
 * Returns the new task.
 */
export const updateTask = (tasksContainer, oldTask, changedValues) => {
	const newTask = {
		...oldTask,
		...changedValues
	};

	// If state changes, move the task from one list to the other (and set/reset the completion date)
	if(oldTask.state !== newTask.state) {
		if(oldTask.state === 'ACTIVE') {
			removeTaskFromList(tasksContainer.active, oldTask);
			insertCompletedTask(tasksContainer, newTask);
		}
		else {
			removeTaskFromList(tasksContainer.completed, oldTask);
			insertActiveTask(tasksContainer, newTask);
		}
	}

	// Otherwise just replace the old task with the new task in the same list
	else if(oldTask.state === 'ACTIVE') {
		replaceTaskInList(tasksContainer.active, oldTask, newTask);
	}
	else {
		replaceTaskInList(tasksContainer.completed, oldTask, newTask);
	}

	return newTask;
};
