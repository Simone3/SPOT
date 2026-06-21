import 'src/components/tasks/TasksPage.css';
import { useState, useEffect, type ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { getInitialTaskState, addTaskToState, refreshVisibleTasksInState, deleteTaskFromState, changeFiltersInState, loadSampleTasksIntoState, loadTasksIntoState, resetFiltersState, updateTaskInState, sortTasksByImportanceInState, moveActiveTaskInState } from 'src/logic/TaskStateLogic';
import type { Task, TaskChange } from 'src/types/TaskTypes';
import type { TaskFilterChange } from 'src/types/FilterTypes';
import { TasksList } from 'src/components/tasks/TasksList';
import { TaskFilters } from 'src/components/tasks/TaskFilters';

type TaskStartupState = {
	state: 'loading';
} | {
	state: 'loaded';
} | {
	state: 'startup-error';
	message: string;
};

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
};

const TasksPage = (): ReactElement => {
	const [ taskState, setTaskState ] = useState(getInitialTaskState());
	const [ taskStartupState, setTaskStartupState ] = useState<TaskStartupState>({ state: 'loading' });

	useEffect(() => {
		let didCancelStartupLoad = false;

		const loadStartupTasks = async(): Promise<void> => {
			const spotStorage = window.spotStorage;

			if(!spotStorage) {
				loadSampleTasksIntoState(setTaskState);
				setTaskStartupState({ state: 'loaded' });

				return;
			}

			try {
				const loadTasksResult = await spotStorage.loadTasks();

				if(didCancelStartupLoad) {
					return;
				}

				if(loadTasksResult.ok) {
					loadTasksIntoState(setTaskState, loadTasksResult.tasks);
					setTaskStartupState({ state: 'loaded' });
				}
				else {
					setTaskStartupState({
						state: 'startup-error',
						message: loadTasksResult.message
					});
				}
			}
			catch(error) {
				if(!didCancelStartupLoad) {
					setTaskStartupState({
						state: 'startup-error',
						message: getErrorMessage(error)
					});
				}
			}
		};

		void loadStartupTasks();

		return () => {
			didCancelStartupLoad = true;
		};
	}, []);

	const onFilterChange = (changedFilters: TaskFilterChange): void => {
		changeFiltersInState(setTaskState, changedFilters);
	};

	const onResetDefaultFilters = (): void => {
		resetFiltersState(setTaskState);
	};

	const onRefreshTasks = (): void => {
		refreshVisibleTasksInState(setTaskState);
	};

	const onMoveActiveTask = (fromIndex: number, toIndex: number): void => {
		moveActiveTaskInState(setTaskState, fromIndex, toIndex);
	};

	const onSortTasksByImportance = (): void => {
		sortTasksByImportanceInState(setTaskState);
	};

	const onAddNewTask = (): void => {
		addTaskToState(setTaskState);
	};

	const onUpdateTask = (oldTask: Task, changedValues: TaskChange): void => {
		updateTaskInState(setTaskState, oldTask, changedValues);
	};

	const onDeleteTask = (task: Task): void => {
		deleteTaskFromState(setTaskState, task);
	};

	if(taskStartupState.state === 'loading') {
		return (
			<Page>
				<Pane relativeSize={1}>
					<div className='tasks-page-status' role='status'>
						Loading tasks...
					</div>
				</Pane>
			</Page>
		);
	}

	if(taskStartupState.state === 'startup-error') {
		return (
			<Page>
				<Pane relativeSize={1}>
					<div className='tasks-page-status tasks-page-status-error' role='alert'>
						<h3 className='tasks-page-status-title'>Task storage is unavailable</h3>
						<p className='tasks-page-status-message'>{taskStartupState.message}</p>
					</div>
				</Pane>
			</Page>
		);
	}

	return (
		<Page>
			<Pane relativeSize={1}>
				<TaskFilters
					domains={taskState.domainsContainer.filters}
					filters={taskState.filters}
					onFilterChange={onFilterChange}
					onResetDefaultFilters={onResetDefaultFilters}
				/>
			</Pane>
			<Pane relativeSize={2}>
				<TasksList
					title='Tasks'
					tasks={taskState.tasksContainer.active}
					inputDomains={taskState.domainsContainer.form}
					onUpdateTask={onUpdateTask}
					onDeleteTask={onDeleteTask}
					showActions={true}
					onRefreshTasks={onRefreshTasks}
					onMoveTask={onMoveActiveTask}
					onSortTasksByImportance={onSortTasksByImportance}
					onAddNewTask={onAddNewTask}
				/>
				{taskState.filters.showCompleted &&
					<TasksList
						title='Completed Tasks'
						tasks={taskState.tasksContainer.completed}
						inputDomains={taskState.domainsContainer.form}
						onUpdateTask={onUpdateTask}
						onDeleteTask={onDeleteTask}
						showActions={false}
					/>
				}
			</Pane>
		</Page>
	);
};

export { TasksPage };
