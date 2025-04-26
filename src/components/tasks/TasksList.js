import './TasksList.css';
import Task from './Task';
import Clickable from '../common/Clickable';
import AddIcon from '../icons/AddIcon';

const TasksList = ({ title, tasks, showAddNew, onSaveNewTask, onUpdateTask, onDeleteTask }) => {
	return (
		<div>
			<div className='tasks-list-header-line'>
				<h3 className='tasks-list-title'>{title}</h3>
				{showAddNew && <div className='tasks-list-actions'>
					<Clickable onClick={onSaveNewTask}>
						<AddIcon className='tasks-list-add-icon'/>
						<div className='tasks-list-add-label'>TODO: add new task to be placed here!</div>
					</Clickable>
				</div>}
			</div>
			{tasks.map((task) => {
				if(task.visible) {
					return (
						<Task
							key={task.id}
							task={task}
							onSave={(newValues) => {
								onUpdateTask(task, newValues);
							}}
							onDelete={() => {
								onDeleteTask(task);
							}}
						/>
					);
				}
				else {
					return undefined;
				}
			})}
		</div>
	);
};

export default TasksList;
