import { useState, useEffect } from 'react';
import Page from 'src/components/common/Page';
import Pane from 'src/components/common/Pane';
import { getInitialTaskState, addTaskToState, refreshVisibleTasksInState, deleteTaskFromState, changeFiltersInState, loadBackEndTasksIntoState, resetFiltersState, updateTaskInState, sortTasksByImportanceInState, moveActiveTaskInState } from 'src/logic/TaskStateLogic';
import type { Task, TaskChange } from 'src/types/TaskTypes';
import type { TaskFilterChange } from 'src/types/FilterTypes';
import TasksList from 'src/components/tasks/TasksList';
import TaskFilters from 'src/components/tasks/TaskFilters';

const TasksPage = () => {
	const [ taskState, setTaskState ] = useState(getInitialTaskState());

	useEffect(() => {
		loadBackEndTasksIntoState(setTaskState);
		return () => {
			setTaskState(() => {
				return getInitialTaskState();
			});
		};
	}, []);

	const onFilterChange = (changedFilters: TaskFilterChange) => {
		changeFiltersInState(setTaskState, changedFilters);
	};

	const onResetDefaultFilters = () => {
		resetFiltersState(setTaskState);
	};

	const onRefreshTasks = () => {
		refreshVisibleTasksInState(setTaskState);
	};

	const onMoveActiveTask = (fromIndex: number, toIndex: number) => {
		moveActiveTaskInState(setTaskState, fromIndex, toIndex);
	};

	const onSortTasksByImportance = () => {
		sortTasksByImportanceInState(setTaskState);
	};

	const onAddNewTask = () => {
		addTaskToState(setTaskState);
	};

	const onUpdateTask = (oldTask: Task, changedValues: TaskChange) => {
		updateTaskInState(setTaskState, oldTask, changedValues);
	};

	const onDeleteTask = (task: Task) => {
		deleteTaskFromState(setTaskState, task);
	};

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

export default TasksPage;
