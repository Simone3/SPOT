import './TasksList.css';
import Task from './Task';
import AddIcon from '../icons/AddIcon';
import RefreshIcon from '../icons/RefreshIcon';
import SortIcon from '../icons/SortIcon';
import Header from '../common/Header';

const TasksList = ({ title, tasks, inputDomains, onRefreshTasks, onSortTasksByImportance, onAddNewTask, onUpdateTask, onDeleteTask }) => {
	const visibleTasks = tasks.filter((task) => task.visible);
	return (
		<div className='tasks-list-container'>
			<Header
				title={title}
				actions={[{
					icon: <RefreshIcon />,
					label: 'Refresh',
					onClick: onRefreshTasks
				}, {
					icon: <SortIcon />,
					label: 'Sort by importance',
					onClick: onSortTasksByImportance
				}, {
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
			{visibleTasks.length === 0 && <div className='tasks-list-empty-message'>No tasks to display</div>}
		</div>
	);
};

export default TasksList;
