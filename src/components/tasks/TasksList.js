import './TasksList.css';
import Task from './Task';
import Clickable from '../common/Clickable';
import AddIcon from '../icons/AddIcon';

const TasksList = ({ title, tasks, inputDomains, onRefreshTasks, onSortTasksByImportance, onAddNewTask, onUpdateTask, onDeleteTask }) => {
	const visibleTasks = tasks.filter((task) => task.visible);
	return (
		<div className='tasks-list-container'>
			<div className='tasks-list-header-line'>
				<h3 className='tasks-list-title'>{title}</h3>
				{onAddNewTask && <div className='tasks-list-actions'>
					<Clickable onClick={onAddNewTask}>
						<AddIcon className='tasks-list-add-icon'/>
						<div className='tasks-list-add-label'>Add task</div>
					</Clickable>
				</div>}
			</div>
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
			{visibleTasks.length === 0 && !showAddNew && <div className='tasks-list-empty-message'>No tasks to display</div>}
		</div>
	);
};

export default TasksList;
