import { useState, useEffect } from 'react';
import Page from '../common/Page';
import Pane from '../common/Pane';
import TaskFilters from './TaskFilters';
import { getInitialTaskState, addTaskToState, refreshVisibleTasksInState, deleteTaskFromState, changeFiltersInState, loadBackEndTasksIntoState, resetFiltersState, updateTaskInState, sortTasksByImportanceInState, moveActiveTaskInState } from '../../logic/TaskStateLogic';
import TasksList from './TasksList';

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

	const onFilterChange = (changedFilters) => {
		changeFiltersInState(setTaskState, changedFilters);
	};

	const onResetDefaultFilters = () => {
		resetFiltersState(setTaskState);
	};

	const onRefreshTasks = () => {
		refreshVisibleTasksInState(setTaskState);
	};

	const onMoveActiveTask = (fromIndex, toIndex) => {
		moveActiveTaskInState(setTaskState, fromIndex, toIndex);
	};

	const onSortTasksByImportance = () => {
		sortTasksByImportanceInState(setTaskState);
	};

	const onAddNewTask = () => {
		addTaskToState(setTaskState);
	};

	const onUpdateTask = (oldTask, changedValues) => {
		updateTaskInState(setTaskState, oldTask, changedValues);
	};

	const onDeleteTask = (task) => {
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
