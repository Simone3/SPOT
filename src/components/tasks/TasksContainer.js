import Task from './Task';

const TasksContainer = () => {
	return (
		<div>
			<h3>Urgent</h3>
			<Task task={{ text: 'My first task', state: 'ACTIVE', priority: 'URGENT', owner: 'Me', dueDate: new Date(), tags: [ 'TAG1' ] }}/>
			<Task task={{ text: 'My second task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1' ] }}/>
			<Task task={{ text: 'My third task', state: 'ACTIVE', priority: 'NORMAL', dueDate: new Date('2024-11-30'), tags: [ 'TAG1' ] }}/>
			<Task task={{ text: 'My fourth task', state: 'ACTIVE', priority: 'LOW', tags: [ 'TAG1' ] }}/>
			<Task task={{ text: 'My fifth task', state: 'ACTIVE', priority: 'URGENT', owner: 'Some Person', tags: [] }}/>
			<Task task={{ text: 'My sixth task', state: 'ACTIVE', priority: 'HIGH', dueDate: new Date('2025-05-03'), tags: [] }}/>
			<Task task={{ text: 'My seventh task', state: 'ACTIVE', priority: 'NORMAL', tags: [] }}/>
			<Task task={{ text: 'My seventh task', state: 'COMPLETED', priority: 'LOW', tags: [] }}/>
			<Task task={{ text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'URGENT', owner: 'Me', dueDate: new Date(), tags: [ 'TAG1' ] }}/>
			<Task task={{ text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1' ] }}/>
			<Task task={{ text: 'My task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1', 'TAG1' ] }}/>
			<Task task={{ text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [] }}/>
			<h3>Soon</h3>
			<h3>High Priority</h3>
			<h3>Normal Priority</h3>
			<h3>Low Priority</h3>
			<h3>Completed</h3>
		</div>
	);
};

export default TasksContainer;
