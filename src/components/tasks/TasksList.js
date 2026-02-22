import './TasksList.css';
import { DragDropProvider } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import Task from './Task';
import AddIcon from '../icons/AddIcon';
import RefreshIcon from '../icons/RefreshIcon';
import SortIcon from '../icons/SortIcon';
import Header from '../common/Header';

const TasksList = ({ title, tasks, inputDomains, onRefreshTasks, onMoveTask, onSortTasksByImportance, onAddNewTask, onUpdateTask, onDeleteTask, showActions }) => {
	const visibleTasks = [];
	const originalIndices = [];
	for(let i = 0; i < tasks.length; i++) {
		if(tasks[i].visible) {
			visibleTasks.push(tasks[i]);
			originalIndices.push(i);
		}
	}

	const onDragEnd = (event) => {
		if(event.canceled) {
			return;
		}

		const { source } = event.operation;
		if(isSortable(source)) {
			const { initialIndex, index } = source;
			if(initialIndex !== index) {
				onMoveTask(originalIndices[initialIndex], originalIndices[index]);
			}
		}
	};

	return (
		<div className='tasks-list-container'>
			<Header
				title={title}
				actions={showActions && [{
					id: 'refresh',
					icon: <RefreshIcon />,
					label: 'Refresh',
					onClick: onRefreshTasks
				}, {
					id: 'sort',
					icon: <SortIcon />,
					label: 'Sort by importance',
					onClick: onSortTasksByImportance
				}, {
					id: 'add',
					icon: <AddIcon />,
					label: 'Add task',
					onClick: onAddNewTask
				}]}
			/>
			<DragDropProvider onDragEnd={onDragEnd}>
				{visibleTasks.map((task, index) =>
					<Task
						id={task.id}
						key={task.id}
						index={index}
						task={task}
						inputDomains={inputDomains}
						onSave={(changedValues) => {
							onUpdateTask(task, changedValues);
						}}
						onDelete={() => {
							onDeleteTask(task);
						}}
					/>)
				}
			</DragDropProvider>
			{visibleTasks.length === 0 && <div className='tasks-list-empty-message'>No task found! Change the current filters or create new tasks.</div>}
		</div>
	);
};

export default TasksList;
