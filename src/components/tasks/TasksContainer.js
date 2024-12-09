import TasksList from './TasksList';

const TasksContainer = () => {

	const urgentTasks = [
		{ text: 'My urgent task', state: 'ACTIVE', priority: 'URGENT', owner: 'Some Person', tags: [] }
	];
	const dueSoon = [
		{ text: 'My first due soon task', state: 'ACTIVE', priority: 'URGENT', owner: 'Me', dueDate: new Date(), tags: [ 'TAG1' ] },
		{ text: 'My second due soon task', state: 'ACTIVE', priority: 'NORMAL', dueDate: new Date('2024-11-30'), tags: [ 'TAG1' ] },
		{ text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'URGENT', owner: 'Me', dueDate: new Date(), tags: [ 'TAG1' ] },
		{ text: 'My third due soon task', state: 'ACTIVE', priority: 'LOW', dueDate: new Date(), tags: [ 'TAG1' ] }
	];
	const highPriorityTasks = [
		{ text: 'My HP task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1' ] },
		{ text: 'My other HP task', state: 'ACTIVE', priority: 'HIGH', dueDate: new Date('2025-05-03'), tags: [] },
		{ text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1' ] },
		{ text: 'A HP task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1' ] },
		{ text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [] }
	];
	const normalPriorityTasks = [
		{ text: 'My normal task', state: 'ACTIVE', priority: 'NORMAL', tags: [] }
	];
	const lowPriorityTasks = [];
	const completedTasks = [
		{ text: 'My completed task', state: 'COMPLETED', priority: 'HIGH', owner: 'Some Person', dueDate: new Date('2024-05-03'), tags: [ 'TAG1', 'TAG2' ] },
		{ text: 'A completed task', state: 'COMPLETED', priority: 'LOW', tags: [] }
	];

	return (
		<div>
			<TasksList title='Urgent' tasks={urgentTasks}/>
			<TasksList title='Due Soon' tasks={dueSoon}/>
			<TasksList title='High Priority' tasks={highPriorityTasks}/>
			<TasksList title='Normal Priority' tasks={normalPriorityTasks}/>
			<TasksList title='Low Priority' tasks={lowPriorityTasks}/>
			<TasksList title='Completed' tasks={completedTasks}/>
		</div>
	);
};

export default TasksContainer;
