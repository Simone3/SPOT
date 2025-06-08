import { useState, useEffect, useRef } from 'react';
import Page from '../common/Page';
import Pane from '../common/Pane';
import TaskFilters from './TaskFilters';
import { getInitialTaskState, onAddNewTask, onDeleteTask, onFilterChange, onLoadBackEndTasks, onResetDefaultFilters, onUpdateTask } from '../../logic/TaskStateLogic';
import TasksList from './TasksList';

const TasksPage = () => {
	const [ taskState, setTaskState ] = useState(getInitialTaskState());

	// FIXME: load from DB + fix the empty dependency array
	useEffect(() => {
		onLoadBackEndTasks(setTaskState);
		return () => {
			setTaskState(() => {
				return getInitialTaskState();
			});
		};
	}, []);

	return (
		<Page>
			<Pane relativeSize={1}>
				<TaskFilters
					domains={taskState.domainsContainer.filters}
					filters={taskState.filters}
					onFilterChange={(changedFilters) => {
						onFilterChange(setTaskState, changedFilters);
					}}
					onResetDefaultFilters={() => {
						onResetDefaultFilters(setTaskState);
					}}
				/>
			</Pane>
			<Pane relativeSize={2}>
				<TasksList
					title='Tasks'
					tasks={taskState.tasksContainer.active}
					inputDomains={taskState.domainsContainer.form}
					showAddNew={true}
					onAddNewTask={(task) => {
						onAddNewTask(setTaskState, task);
					}}
					onUpdateTask={(oldTask, changedValues) => {
						onUpdateTask(setTaskState, oldTask, changedValues);
					}}
					onDeleteTask={(task) => {
						onDeleteTask(setTaskState, task);
					}}
				/>
				{taskState.filters.showCompleted &&
					<TasksList
						title='Completed Tasks'
						tasks={taskState.tasksContainer.completed}
						inputDomains={taskState.domainsContainer.form}
						showAddNew={false}
						onAddNewTask={(task) => {
							onAddNewTask(setTaskState, task);
						}}
						onUpdateTask={(oldTask, changedValues) => {
							onUpdateTask(setTaskState, oldTask, changedValues);
						}}
						onDeleteTask={(task) => {
							onDeleteTask(setTaskState, task);
						}}
					/>
				}
			</Pane>
		</Page>
	);
};

export default TasksPage;
