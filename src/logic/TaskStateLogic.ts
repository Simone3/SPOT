import type { Dispatch, SetStateAction } from 'react';
import type { DomainsContainer } from 'src/types/DomainTypes';
import type { TaskFilters, TaskFilterChange } from 'src/types/FilterTypes';
import type { Task, TaskChange, TasksContainer } from 'src/types/TaskTypes';
import { cloneFilters, getInitialFilters, refreshTasksVisibility, refreshTaskVisibility } from 'src/logic/FiltersLogic';
import { getInitialTasks, cloneTask, cloneTasks, loadBackEndTasks, addNewTask, deleteTask, updateTask, forceSortActiveTasksByImportance, moveActiveTask } from 'src/logic/TasksLogic';
import { getInitialDomains, cloneDomains, addDomainsForTasks, removeDomainsForTask, updateDomainsForTask, addDomainsForTask, updateFiltersOnDomainsChange } from 'src/logic/DomainsLogic';

export interface TaskStateContainer {
	tasksContainer: TasksContainer;
	domainsContainer: DomainsContainer;
	filters: TaskFilters;
}

type SetTaskState = Dispatch<SetStateAction<TaskStateContainer>>;

export interface AddTaskToTaskStateResult {
	taskState: TaskStateContainer;
	task: Task;
}

export interface UpdateTaskInTaskStateResult {
	taskState: TaskStateContainer;
	task: Task;
}

export interface BulkTaskStateUpdateResult {
	taskState: TaskStateContainer;
	previousTasksContainer: TasksContainer;
}

export const getInitialTaskState = (): TaskStateContainer => {
	return {
		tasksContainer: getInitialTasks(),
		domainsContainer: getInitialDomains(),
		filters: getInitialFilters()
	};
};

export const loadTasksIntoTaskState = (prevTaskState: TaskStateContainer, tasks: Task[]): TaskStateContainer => {
	const newTasksContainer = getInitialTasks();
	const newDomainsContainer = getInitialDomains();

	// Add tasks to the proper state lists
	loadBackEndTasks(newTasksContainer, tasks);

	// Extract domains from all tasks and add them to the proper state lists
	addDomainsForTasks(newDomainsContainer, newTasksContainer);

	// Compute initial visibility of all tasks
	refreshTasksVisibility(newTasksContainer, prevTaskState.filters, prevTaskState.filters, cloneTask);

	return {
		tasksContainer: newTasksContainer,
		domainsContainer: newDomainsContainer,
		filters: prevTaskState.filters
	};
};

export const loadTasksIntoState = (setTaskState: SetTaskState, tasks: Task[]): void => {
	setTaskState((prevTaskState) => {
		return loadTasksIntoTaskState(prevTaskState, tasks);
	});
};

export const addTaskToTaskState = (prevTaskState: TaskStateContainer): AddTaskToTaskStateResult => {
	const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
	const newDomainsContainer = cloneDomains(prevTaskState.domainsContainer);

	// Add new task to the state lists
	const newTask = addNewTask(newTasksContainer);

	// Extract domains from the new task and update the state lists
	addDomainsForTask(newDomainsContainer, newTask);

	// New tasks are always visible, regardless of current filters
	newTask.visible = true;

	return {
		taskState: {
			tasksContainer: newTasksContainer,
			domainsContainer: newDomainsContainer,
			filters: prevTaskState.filters
		},
		task: newTask
	};
};

export const addTaskToState = (setTaskState: SetTaskState): void => {
	setTaskState((prevTaskState) => {
		return addTaskToTaskState(prevTaskState).taskState;
	});
};

export const updateTaskInTaskState = (prevTaskState: TaskStateContainer, oldTask: Task, changedValues: TaskChange): UpdateTaskInTaskStateResult => {
	const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
	const newDomainsContainer = cloneDomains(prevTaskState.domainsContainer);
	const newFilters = cloneFilters(prevTaskState.filters);

	// Apply changes to the task in the state list
	const newTask = updateTask(newTasksContainer, oldTask, changedValues);

	// Extract changed domains and update the state lists
	updateDomainsForTask(newDomainsContainer, oldTask, newTask, changedValues);

	// Clean currently selected filters if domains values were removed
	updateFiltersOnDomainsChange(newDomainsContainer.filters, newFilters);

	// Refresh the changed task visibility only if state changed (in any other case the task remains visibile until the user refreshes the list e.g. by changing filters)
	if(oldTask.state !== newTask.state) {
		refreshTaskVisibility(newTask, newFilters);
	}

	return {
		taskState: {
			tasksContainer: newTasksContainer,
			domainsContainer: newDomainsContainer,
			filters: newFilters
		},
		task: newTask
	};
};

export const updateTaskInState = (setTaskState: SetTaskState, oldTask: Task, changedValues: TaskChange): void => {
	setTaskState((prevTaskState) => {
		return updateTaskInTaskState(prevTaskState, oldTask, changedValues).taskState;
	});
};

export const deleteTaskFromTaskState = (prevTaskState: TaskStateContainer, task: Task): TaskStateContainer => {
	const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
	const newDomainsContainer = cloneDomains(prevTaskState.domainsContainer);
	const newFilters = cloneFilters(prevTaskState.filters);

	// Remove the task from the state list
	deleteTask(newTasksContainer, task);

	// Update domains in the state lists
	removeDomainsForTask(newDomainsContainer, task);

	// Clean currently selected filters if domains values were removed
	updateFiltersOnDomainsChange(newDomainsContainer.filters, newFilters);

	return {
		tasksContainer: newTasksContainer,
		domainsContainer: newDomainsContainer,
		filters: newFilters
	};
};

export const deleteTaskFromState = (setTaskState: SetTaskState, task: Task): void => {
	setTaskState((prevTaskState) => {
		return deleteTaskFromTaskState(prevTaskState, task);
	});
};

export const changeFiltersInTaskState = (prevTaskState: TaskStateContainer, changedFilters: TaskFilterChange): TaskStateContainer => {
	const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
	const newFilters = {
		...prevTaskState.filters,
		...changedFilters
	};

	// Simply refresh the task lists based on the new filters
	refreshTasksVisibility(newTasksContainer, prevTaskState.filters, newFilters, cloneTask);

	return {
		tasksContainer: newTasksContainer,
		domainsContainer: prevTaskState.domainsContainer,
		filters: newFilters
	};
};

export const changeFiltersInState = (setTaskState: SetTaskState, changedFilters: TaskFilterChange): void => {
	setTaskState((prevTaskState) => {
		return changeFiltersInTaskState(prevTaskState, changedFilters);
	});
};

export const resetFiltersTaskState = (prevTaskState: TaskStateContainer): TaskStateContainer => {
	const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
	const newFilters = getInitialFilters();

	// Simply refresh the task lists based on the new filters
	refreshTasksVisibility(newTasksContainer, prevTaskState.filters, newFilters, cloneTask);

	return {
		tasksContainer: newTasksContainer,
		domainsContainer: prevTaskState.domainsContainer,
		filters: newFilters
	};
};

export const resetFiltersState = (setTaskState: SetTaskState): void => {
	setTaskState((prevTaskState) => {
		return resetFiltersTaskState(prevTaskState);
	});
};

export const refreshVisibleTasksInTaskState = (prevTaskState: TaskStateContainer): TaskStateContainer => {
	const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);

	// Simply refresh the task lists based on the current filters
	refreshTasksVisibility(newTasksContainer, prevTaskState.filters, prevTaskState.filters, cloneTask);

	return {
		tasksContainer: newTasksContainer,
		domainsContainer: prevTaskState.domainsContainer,
		filters: prevTaskState.filters
	};
};

export const refreshVisibleTasksInState = (setTaskState: SetTaskState): void => {
	setTaskState((prevTaskState) => {
		return refreshVisibleTasksInTaskState(prevTaskState);
	});
};

export const sortTasksByImportanceInTaskState = (prevTaskState: TaskStateContainer): BulkTaskStateUpdateResult => {
	const previousTasksContainer = cloneTasks(prevTaskState.tasksContainer);
	const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);

	// Force sort by importance
	forceSortActiveTasksByImportance(newTasksContainer);

	return {
		taskState: {
			tasksContainer: newTasksContainer,
			domainsContainer: prevTaskState.domainsContainer,
			filters: prevTaskState.filters
		},
		previousTasksContainer
	};
};

export const sortTasksByImportanceInState = (setTaskState: SetTaskState): void => {
	setTaskState((prevTaskState) => {
		return sortTasksByImportanceInTaskState(prevTaskState).taskState;
	});
};

export const moveActiveTaskInTaskState = (prevTaskState: TaskStateContainer, fromIndex: number, toIndex: number): BulkTaskStateUpdateResult => {
	const previousTasksContainer = cloneTasks(prevTaskState.tasksContainer);
	const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);

	// Move task
	moveActiveTask(newTasksContainer, fromIndex, toIndex);

	return {
		taskState: {
			tasksContainer: newTasksContainer,
			domainsContainer: prevTaskState.domainsContainer,
			filters: prevTaskState.filters
		},
		previousTasksContainer
	};
};

export const moveActiveTaskInState = (setTaskState: SetTaskState, fromIndex: number, toIndex: number): void => {
	setTaskState((prevTaskState) => {
		return moveActiveTaskInTaskState(prevTaskState, fromIndex, toIndex).taskState;
	});
};
