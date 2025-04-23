import TasksList from './TasksList';

const TasksContainer = () => {
	return (
		<div>
			<TasksList
				tasks={[]}
				onStartEditingTask={() => {}}
				showAddTaskButton={true}
				onStartAddingTask={() => {}}
			/>
		</div>
	);
};

export default TasksContainer;
