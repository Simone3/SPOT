import { TASKS_CONFIG } from 'src/config/AppConfig';
import { insertIntoManuallySortedList, moveInManuallySortedList, recomputeSortPositions } from 'src/framework/utils/ManuallySortedList';
import type { Task, TaskChange, TaskPriorityValue, TasksContainer } from 'src/types/TaskTypes';

const PRIORITIES_SORT: Record<TaskPriorityValue, number> = {
	LOW: 0,
	NORMAL: 1,
	HIGH: 2,
	URGENT: 3
};

/**
 * Returns a new object containing the initial task lists.
 * @returns Empty task lists grouped by state.
 */
export const getInitialTasks = (): TasksContainer => {
	return {
		active: [],
		completed: []
	};
};

export const cloneTask = (task: Task): Task => {
	return {
		...task,
		tags: [ ...task.tags ],
		completionDate: task.completionDate ? new Date(task.completionDate) : undefined
	};
};

/**
 * Clones the object and the contained lists, while keeping task objects shared.
 * @param tasksContainer Task lists to clone.
 * @returns A shallow clone of the task container.
 */
export const cloneTasks = (tasksContainer: TasksContainer): TasksContainer => {
	return {
		active: [ ...tasksContainer.active ],
		completed: [ ...tasksContainer.completed ]
	};
};

/**
 * Default comparator (by ID)
 * @param taskA First task to compare.
 * @param taskB Second task to compare.
 * @returns The ID sort order.
 */
const taskIdCompareFunction = (taskA: Task, taskB: Task): number => {
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
 * @param taskA First active task to compare.
 * @param taskB Second active task to compare.
 * @returns The active task sort order.
 */
const activeTasksPositionCompareFunction = (taskA: Task, taskB: Task): number => {
	const positionCompare = taskA.sortPosition - taskB.sortPosition;
	if(positionCompare !== 0) {
		return positionCompare;
	}
	return taskIdCompareFunction(taskA, taskB);
};

/**
 * Comparator for refreshing active tasks positions (sort by priority DESC, then due date DESC and then default to original manual sort).
 * @param taskA First active task to compare.
 * @param taskB Second active task to compare.
 * @returns The importance sort order.
 */
const activeTasksImportanceCompareFunction = (taskA: Task, taskB: Task): number => {
	const priorityCompare = PRIORITIES_SORT[taskB.priority] - PRIORITIES_SORT[taskA.priority];
	if(priorityCompare !== 0) {
		return priorityCompare;
	}

	let dueDateCompare = 0;
	if(taskA.dueDate && taskB.dueDate) {
		// Due date DESC if both tasks have it
		if(taskA.dueDate < taskB.dueDate) {
			dueDateCompare = 1;
		}
		else if(taskA.dueDate > taskB.dueDate) {
			dueDateCompare = -1;
		}
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
 * Returns the completion instant used to sort completed tasks.
 * A completed task stored without a completion date must not break the whole load, so it simply sorts last.
 * @param task Completed task to read.
 * @returns The completion time, or 0 when the task has no completion date.
 */
const getCompletionTime = (task: Task): number => {
	return task.completionDate ? task.completionDate.getTime() : 0;
};

/**
 * Comparator for completed tasks (sort by completion date DESC and then by ID).
 * @param taskA First completed task to compare.
 * @param taskB Second completed task to compare.
 * @returns The completed task sort order.
 */
const completedTasksCompareFunction = (taskA: Task, taskB: Task): number => {
	const completionCompare = getCompletionTime(taskB) - getCompletionTime(taskA);
	if(completionCompare !== 0) {
		return completionCompare;
	}
	return taskIdCompareFunction(taskA, taskB);
};

/**
 * Sorts all task lists.
 * @param tasksContainer Task lists to sort in place.
 */
const sortAllTasks = (tasksContainer: TasksContainer): void => {
	tasksContainer.active.sort(activeTasksPositionCompareFunction);
	tasksContainer.completed.sort(completedTasksCompareFunction);
};

/**
 * Re-computes the sorting of active tasks by importance (priority / due date), possibly overriding the existing manual sort.
 * @param tasksContainer Task lists containing active tasks to sort.
 */
export const forceSortActiveTasksByImportance = (tasksContainer: TasksContainer): void => {
	// Re-sort the whole list based on importance rules
	tasksContainer.active.sort(activeTasksImportanceCompareFunction);

	// Re-compute sort positions where needed
	recomputeSortPositions(tasksContainer.active, {
		sortPositionStep: TASKS_CONFIG.sortPositionStep,
		cloneElement: cloneTask
	});
};

/**
 * Adds a list of back-end tasks into the task lists.
 * @param tasksContainer Target task lists.
 * @param backEndTasks Tasks received from persistence.
 */
export const loadBackEndTasks = (tasksContainer: TasksContainer, backEndTasks: Task[]): void => {
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
 * @param tasksContainer Task lists to update.
 * @param task Task to mark as completed.
 */
const insertCompletedTask = (tasksContainer: TasksContainer, task: Task): void => {
	task.completionDate = new Date();
	tasksContainer.completed.unshift(task);
};

/**
 * Adds a task to the beginning of the (manually sorted) active tasks list (and also removes any completion date).
 * @param tasksContainer Task lists to update.
 * @param task Task to mark as active.
 */
const insertActiveTask = (tasksContainer: TasksContainer, task: Task): void => {
	task.completionDate = undefined;
	insertIntoManuallySortedList(tasksContainer.active, task, 0, {
		sortPositionStep: TASKS_CONFIG.sortPositionStep
	});
};

/**
 * Adds a new "empty" task to the proper tasks lists and returns it.
 * @param tasksContainer Task lists that receive the new task.
 * @returns The newly created task.
 */
export const addNewTask = (tasksContainer: TasksContainer): Task => {
	const newTask: Task = {
		id: crypto.randomUUID(),
		text: '',
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: undefined,
		dueDate: undefined,
		tags: [],
		sortPosition: 0,
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
 * @param tasksContainer Task lists containing the active task.
 * @param fromIndex Current active task index.
 * @param toIndex Destination active task index.
 */
export const moveActiveTask = (tasksContainer: TasksContainer, fromIndex: number, toIndex: number): void => {
	moveInManuallySortedList(tasksContainer.active, fromIndex, toIndex, {
		sortPositionStep: TASKS_CONFIG.sortPositionStep,
		cloneElement: cloneTask
	});
};

/**
 * Helper to remove a task from an array.
 * @param taskList List to remove the task from.
 * @param task Task to remove.
 */
const removeTaskFromList = (taskList: Task[], task: Task): void => {
	const index = taskList.findIndex((arrayTask) => {
		return task.id === arrayTask.id;
	});
	if(index !== -1) {
		taskList.splice(index, 1);
	}
};

/**
 * Helper to replace a task from an array.
 * @param taskList List containing the old task.
 * @param oldTask Task to replace.
 * @param newTask Replacement task.
 */
const replaceTaskInList = (taskList: Task[], oldTask: Task, newTask: Task): void => {
	const index = taskList.findIndex((arrayTask) => {
		return oldTask.id === arrayTask.id;
	});
	if(index !== -1) {
		taskList[index] = newTask;
	}
};

/**
 * Looks a task up by ID in both task lists.
 * @param tasksContainer Task lists to search.
 * @param taskId Task ID to look for.
 * @returns The task, or undefined when it is not in the lists anymore.
 */
export const findTaskById = (tasksContainer: TasksContainer, taskId: string): Task | undefined => {
	const findInList = (taskList: Task[]): Task | undefined => {
		return taskList.find((task) => {
			return task.id === taskId;
		});
	};

	return findInList(tasksContainer.active) ?? findInList(tasksContainer.completed);
};

/**
 * Removes a task from its task list.
 * @param tasksContainer Task lists to update.
 * @param task Task to remove.
 */
export const deleteTask = (tasksContainer: TasksContainer, task: Task): void => {
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
 * @param tasksContainer Task lists to update.
 * @param oldTask Existing task before changes.
 * @param changedValues Fields to merge into the task.
 * @returns The updated task.
 */
export const updateTask = (tasksContainer: TasksContainer, oldTask: Task, changedValues: TaskChange): Task => {
	const newTask = cloneTask({
		...oldTask,
		...changedValues
	});

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
