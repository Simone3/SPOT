import { useState } from 'react';
import TasksList from './TasksList';
import TaskFormModal from './TaskFormModal';

const TasksContainer = () => {
	const [ formModalOpen, setFormModalOpen ] = useState(false);

	const urgentTasks = [
		{ id: 1, text: 'My urgent task', state: 'ACTIVE', priority: 'URGENT', owner: 'Some Person', tags: [] }
	];
	const dueSoon = [
		{ id: 2, text: 'My first due soon task', state: 'ACTIVE', priority: 'URGENT', owner: 'Me', dueDate: new Date(), tags: [ 'TAG1' ] },
		{ id: 3, text: 'My second due soon task', state: 'ACTIVE', priority: 'NORMAL', dueDate: new Date('2024-11-30'), tags: [ 'TAG1' ] },
		{ id: 4, text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'URGENT', owner: 'Me', dueDate: new Date(), tags: [ 'TAG1' ] },
		{ id: 5, text: 'My third due soon task', state: 'ACTIVE', priority: 'LOW', dueDate: new Date(), tags: [ 'TAG1' ] }
	];
	const highPriorityTasks = [
		{ id: 6, text: 'My HP task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1' ] },
		{ id: 7, text: 'My other HP task', state: 'ACTIVE', priority: 'HIGH', dueDate: new Date('2025-05-03'), tags: [] },
		{ id: 8, text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1', 'TAG2', 'TAG3', 'TAG4', 'TAG5', 'TAG6', 'TAG7', 'TAG8', 'TAG9', 'TAG10', 'TAG11', 'TAG12', 'TAG13' ] },
		{ id: 9, text: 'A HP task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [ 'TAG1', 'TAG2', 'TAG3', 'TAG4', 'TAG5', 'TAG6', 'TAG7', 'TAG8', 'TAG9', 'TAG10', 'TAG11', 'TAG12', 'TAG13' ] },
		{ id: 10, text: 'My very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long task', state: 'ACTIVE', priority: 'HIGH', owner: 'Some Person', tags: [] }
	];
	const normalPriorityTasks = [
		{ id: 11, text: 'My normal task', state: 'ACTIVE', priority: 'NORMAL', tags: [] }
	];
	const lowPriorityTasks = [];
	const completedTasks = [
		{ id: 12, text: 'My completed task', state: 'COMPLETED', priority: 'HIGH', owner: 'Some Person', dueDate: new Date('2024-05-03'), tags: [ 'TAG1', 'TAG2' ] },
		{ id: 13, text: 'A completed task', state: 'COMPLETED', priority: 'LOW', tags: [] }
	];

	const onSaveTask = () => {
		console.log('save here');
		setFormModalOpen(false);
	};

	const onDeleteTask = () => {
		console.log('delete here');
		setFormModalOpen(false);
	};

	const onCloseTaskForm = () => {
		setFormModalOpen(false);
	};

	const onEditTask = () => {
		console.log('edit task');
		setFormModalOpen(true);
	};

	return (
		<div>
			{formModalOpen && <TaskFormModal onSave={onSaveTask} onDiscard={onCloseTaskForm} onDelete={onDeleteTask}/>}
			<TasksList title='Urgent' tasks={urgentTasks} onEditTask={onEditTask}/>
			<TasksList title='Due Soon' tasks={dueSoon} onEditTask={onEditTask}/>
			<TasksList title='High Priority' tasks={highPriorityTasks} onEditTask={onEditTask}/>
			<TasksList title='Normal Priority' tasks={normalPriorityTasks} onEditTask={onEditTask}/>
			<TasksList title='Low Priority' tasks={lowPriorityTasks} onEditTask={onEditTask}/>
			<TasksList title='Completed' tasks={completedTasks} onEditTask={onEditTask}/>
		</div>
	);
};

export default TasksContainer;
