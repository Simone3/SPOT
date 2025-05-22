import { insertIntoManuallySortedList, moveInManuallySortedList } from './ManuallySortedList';

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
const sortAllTasks = (tasksContainer) => {
	tasksContainer.active.sort(activeTasksCompareFunction);
	tasksContainer.completed.sort(completedTasksCompareFunction);
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
 * Adds a new task to the proper tasks lists.
 * It also sets some task fields: id, completionDate, sortPosition.
 */
export const saveNewTask = (tasksContainer, task) => {
	task.id = crypto.randomUUID();
	task.visible = false;

	if(task.state === 'ACTIVE') {
		insertActiveTask(tasksContainer, task);
	}
	else {
		insertCompletedTask(tasksContainer, task);
	}
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
	if(index === -1) {
		throw Error(`Task ${task.id} does not exist, cannot remove from list!`);
	}
	taskList.splice(index, 1);
};

/**
 * Helper to replace a task from an array.
 */
const replaceTaskInList = (taskList, oldTask, newTask) => {
	const index = taskList.findIndex((arrayTask) => oldTask.id === arrayTask.id);
	if(index === -1) {
		throw Error(`Task ${oldTask.id} does not exist, cannot remove from list!`);
	}
	taskList[index] = newTask;
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
		...changedValues,
		visible: false
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
