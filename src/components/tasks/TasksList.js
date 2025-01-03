import Task from './Task';

const TasksList = ({ title, tasks, onStartEditingTask }) => {
	if(!tasks || tasks.length === 0) {
		return null;
	}

	return (
		<div>
			{title && <h3>{title}</h3>}
			{tasks.map((task) => <Task key={task.id} task={task} onEdit={() => {
				onStartEditingTask(task);
			}}/>)}
		</div>
	);
};

export default TasksList;
