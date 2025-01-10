import './TasksList.css';
import Task from './Task';
import Clickable from '../common/Clickable';
import AddIcon from '../icons/AddIcon';

const TasksList = ({ title, tasks, onStartEditingTask, showAddTaskButton, onStartAddingTask }) => {
	if(!tasks || tasks.length === 0) {
		return null;
	}

	return (
		<div>
			<div className='tasks-list-header-line'>
				<h3 className='tasks-list-title'>{title}</h3>
				{showAddTaskButton && <div className='tasks-list-actions'>
					<Clickable onClick={onStartAddingTask}>
						<AddIcon className='tasks-list-add-icon'/>
						<div className='tasks-list-add-label'>Add new task</div>
					</Clickable>
				</div>}
			</div>
			{tasks.map((task) =>
				<Task
					key={task.id}
					task={task}
					onEdit={() => {
						onStartEditingTask(task);
				}}/>
			)}
		</div>
	);
};

export default TasksList;
