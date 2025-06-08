import './TasksList.css';
import Task from './Task';
import Clickable from '../common/Clickable';
import AddIcon from '../icons/AddIcon';

const TasksList = ({ title, tasks, inputDomains, showAddNew, onAddNewTask, onUpdateTask, onDeleteTask }) => {
	const visibleTasks = tasks.filter((task) => task.visible);
	return (
		<div className='tasks-list-container'>
			<div className='tasks-list-header-line'>
				<h3 className='tasks-list-title'>{title}</h3>
				{showAddNew && <div className='tasks-list-actions'>
					<Clickable onClick={onAddNewTask}>
						<AddIcon className='tasks-list-add-icon'/>
						<div className='tasks-list-add-label'>TODO: add new task to be placed here!</div>
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
