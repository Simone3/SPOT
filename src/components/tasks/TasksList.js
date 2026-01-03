import './TasksList.css';
import Task from './Task';
import AddIcon from '../icons/AddIcon';
import RefreshIcon from '../icons/RefreshIcon';
import SortIcon from '../icons/SortIcon';
import Header from '../common/Header';

const TasksList = ({ title, tasks, inputDomains, onRefreshTasks, onSortTasksByImportance, onAddNewTask, onUpdateTask, onDeleteTask, showActions }) => {
	const visibleTasks = tasks.filter((task) => task.visible);
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
			{visibleTasks.map((task) =>
				<Task
					key={task.id}
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
			{visibleTasks.length === 0 && <div className='tasks-list-empty-message'>No task found! Change the current filters or create new tasks.</div>}
		</div>
	);
};

export default TasksList;
