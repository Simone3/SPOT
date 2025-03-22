import { useRef, useState } from 'react';
import TasksList from './TasksList';
import TaskFormModal from './TaskFormModal';

const SAMPLE_RAW_INPUT_TASKS = [
	{
		id: 'd4e92b5e-6879-4c49-bb76-3c7af2a0cbf2',
		text: 'Buy groceries',
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: 'Alice',
		dueDate: new Date('2025-11-12'),
		tags: [ 'shopping', 'errands' ]
	},
	{
		id: '85eeb930-1b29-4b6c-8f33-6a5161b57a60',
		text: 'Finish project report',
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: 'Bob',
		dueDate: new Date(new Date().setHours(0, 0, 0, 0)),
		tags: [ 'work' ]
	},
	{
		id: 'f624563c-0e6a-4c1e-bb7c-885e46be4998',
		text: 'Call the plumber',
		state: 'COMPLETED',
		completionDate: new Date('2024-06-01'),
		priority: 'LOW',
		tags: [ 'home' ]
	},
	{
		id: '70a58f3f-c82b-4f70-901b-b91785b4af01',
		text: 'Schedule a dentist appointment',
		state: 'ACTIVE',
		priority: 'URGENT',
		owner: 'Alice',
		tags: [ 'health' ]
	},
	{
		id: '1c2a8d5a-e5b2-4c73-8bdc-70458c5ae321',
		text: 'Plan weekend trip',
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: 'Charlie',
		dueDate: new Date('2024-01-19'),
		tags: [ 'travel' ]
	},
	{
		id: '3fd9be50-c51d-4fd1-a8c1-4b351cfd76f9',
		text: 'Send invitations for birthday party',
		state: 'COMPLETED',
		completionDate: new Date('2024-03-01'),
		priority: 'HIGH',
		tags: [ 'party', 'personal' ]
	},
	{
		id: '9b62f7de-2b65-432c-8675-4867a0e3c71c',
		text: 'Prepare for team meeting',
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: 'Bob',
		tags: [ 'work' ]
	},
	{
		id: 'dd7300de-065c-4c73-bd98-419aefc66c9f',
		text: 'Clean the garage',
		state: 'ACTIVE',
		priority: 'URGENT',
		tags: [ 'home', 'chores' ]
	},
	{
		id: '11af6ed8-29f3-4e37-a1a2-4bc6a5749cb6',
		text: 'Book flight tickets',
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: 'Charlie',
		tags: [ 'travel', 'urgent' ]
	},
	{
		id: 'b73f0208-bb2e-426c-b654-d362ace38e72',
		text: 'Research new laptop models',
		state: 'ACTIVE',
		priority: 'NORMAL',
		tags: []
	},
	{
		id: 'a1c4c59f-d272-4b29-a8d7-815db5de2899',
		text: 'Walk the dog',
		state: 'ACTIVE',
		priority: 'LOW',
		owner: 'John',
		dueDate: new Date('2024-01-19'),
		tags: [ 'pets', 'exercise' ]
	},
	{
		id: 'c87f4a31-4696-4982-bd2c-cd48de8f0cf3',
		text: 'Organize bookshelves',
		state: 'COMPLETED',
		completionDate: new Date('2024-05-01'),
		priority: 'LOW',
		tags: [ 'home' ]
	},
	{
		id: 'f5b2d93a-b1d7-4f70-9c96-12f9ec8d1e73',
		text: 'Submit tax documents',
		state: 'ACTIVE',
		priority: 'URGENT',
		owner: 'Jane',
		dueDate: new Date('2025-11-20'),
		tags: [ 'finance', 'important' ]
	},
	{
		id: '3b4587b7-6d61-4b4e-859b-05e0a6a32261',
		text: 'Prepare presentation slides',
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: 'Emily',
		dueDate: new Date('2025-01-23'),
		tags: [ 'work' ]
	},
	{
		id: 'a4c57919-16ef-46af-aadd-d233935fd24a',
		text: 'Water the plants',
		state: 'ACTIVE',
		priority: 'HIGH',
		tags: [ 'chores', 'home' ]
	},
	{
		id: '92edc91a-d98c-4a66-b45f-2a7ae0cc79a3',
		text: 'Pick up dry cleaning',
		state: 'COMPLETED',
		completionDate: new Date('2024-01-01'),
		priority: 'LOW',
		owner: 'John',
		dueDate: new Date('2023-01-23'),
		tags: [ 'errands' ]
	},
	{
		id: 'be38d889-70de-4621-9fbf-295e5c90338b',
		text: 'Write thank-you notes',
		state: 'ACTIVE',
		priority: 'NORMAL',
		tags: [ 'personal' ]
	},
	{
		id: '0eb67958-6c03-4b3f-a99b-b4b012ccf8c4',
		text: 'Review contract details',
		state: 'ACTIVE',
		priority: 'URGENT',
		owner: 'Jane',
		dueDate: new Date('2025-01-25'),
		tags: [ 'work' ]
	},
	{
		id: 'de6b1e97-d46b-420c-8cc1-f0c69bfb116e',
		text: 'Plan family dinner menu',
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: 'Emily',
		tags: [ 'family', 'food' ]
	},
	{
		id: '72b2e08e-1c4e-42ba-89a2-56b324eb4b12',
		text: 'Fix the leaky faucet',
		state: 'ACTIVE',
		priority: 'LOW',
		tags: [ 'home', 'repair' ]
	}
];

const DEFAULT_FILTERS = {
	text: '',
	owners: [],
	dueDates: [],
	priorities: [],
	tags: [],
	showCompleted: false
};

const DEFAULT_TASK = {
	id: undefined,
	text: undefined,
	state: 'ACTIVE',
	priority: 'HIGH',
	owner: undefined,
	dueDate: undefined,
	tags: []
};

const matchesFilters = (task, filters) => {
	if(task.state === 'COMPLETED' && !filters.showCompleted) {
		return false;
	}

	if(filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
		return false;
	}

	if(filters.owners.length > 0 && !filters.owners.includes(task.priority)) {
		return false;
	}

	if(filters.dueDates.length > 0 && !filters.dueDates.includes(task.priority)) {
		return false;
	}

	if(filters.tags.length > 0 && task.tags.length > 0 && task.tags.every((tag) => !filters.tags.includes(tag))) {
		return false;
	}

	if(filters.text && !new RegExp(filters.text, 'i').test(task.text)) {
		return false;
	}

	return true;
};

const addTask = (rawTask, activeTasks, completedTasks) => {
	const task = {
		id: rawTask.id,
		text: rawTask.text,
		state: rawTask.state,
		priority: rawTask.priority,
		owner: rawTask.owner,
		dueDate: rawTask.dueDate,
		tags: [ ...rawTask.tags ],
		completionDate: rawTask.completionDate,
		sortPosition: rawTask.sortPosition,
		visible: false
	};

	if(task.state === 'ACTIVE') {
		activeTasks.push(task);
	}
	else {
		completedTasks.push(task);
	}

	return task;
};

const addDomain = (domainValue, domainList, updateCount, updateActiveCount) => {
	if(domainValue) {
		const domainId = domainValue.toLowerCase();
		let domain = domainList.find((value) => value.id === domainId);
		if(!domain) {
			domain = {
				id: domainId,
				label: domainValue,
				count: 0,
				activeCount: 0
			};
			domainList.push(domain);
		}

		domain.count += updateCount;
		domain.activeCount += updateActiveCount;
	}
};

const activeTasksCompareFunction = (taskA, taskB) => {
	const position = taskA.sortPosition - taskB.sortPosition;
	if(position !== 0) {
		return position;
	}
	if(taskA.id < taskB.id) {
		return -1;
	}
	if(taskA.id > taskB.id) {
		return 1;
	}
	return 0;
};

const completedTasksCompareFunction = (taskA, taskB) => {
	return taskA.completionDate - taskB.completionDate;
};

const domainCompareFunction = (domainA, domainB) => {
	if(domainA.id < domainB.id) {
		return -1;
	}
	if(domainA.id > domainB.id) {
		return 1;
	}
	return 0;
};

const TasksContainer = () => {

	const [ activeTasks, setActiveTasks ] = useState([]);
	const [ completedTasks, setCompletedTasks ] = useState([]);

	const [ priorities, setPriorities ] = useState(() => {
		const initialPriorities = [];
		addDomain('URGENT', initialPriorities, 0, 0);
		addDomain('HIGH', initialPriorities, 0, 0);
		addDomain('MEDIUM', initialPriorities, 0, 0);
		addDomain('LOW', initialPriorities, 0, 0);
		return initialPriorities;
	});
	const [ owners, setOwners ] = useState([]);
	const [ dueDates, setDueDates ] = useState([]);
	const [ tags, setTags ] = useState([]);

	const currentFilters = useState({ ...DEFAULT_FILTERS });

	const loadRawTasksIntoState = (rawTasks) => {
		const newActiveTasks = [ ...activeTasks ];
		const newCompletedTasks = [ ...completedTasks ];
		const newPriorities = [ ...priorities ];
		const newOwners = [ ...owners ];
		const newDueDates = [ ...dueDates ];
		const newTags = [ ...tags ];

		// Add task and domains for each row task
		for(const rawTask of rawTasks) {
			const task = addTask(rawTask, newActiveTasks, newCompletedTasks);
			const updateCount = 1;
			const updateActiveCount = task.state === 'ACTIVE' ? 1 : 0;
			addDomain(task.priority, newPriorities, updateCount, updateActiveCount);
			addDomain(task.owner, newOwners, updateCount, updateActiveCount);
			addDomain(task.dueDate, newDueDates, updateCount, updateActiveCount);
			for(const tag of task.tags) {
				addDomain(tag, newTags, updateCount, updateActiveCount);
			}
		}

		// Sort all lists (except priorities, which are already sorted by default)
		newActiveTasks.sort(activeTasksCompareFunction);
		newCompletedTasks.sort(completedTasksCompareFunction);
		newOwners.sort(domainCompareFunction);
		newDueDates.sort(domainCompareFunction);
		newTags.sort(domainCompareFunction);

		// Update state
		setActiveTasks(newActiveTasks);
		setCompletedTasks(newCompletedTasks);
		setPriorities(newPriorities);
		setOwners(newOwners);
		setDueDates(newDueDates);
		setTags(newTags);
	};

	const refreshVisibility = () => {
		
		// TODO apply to first load or afterwards?
		// think about all interactions (load raw task, delete task, add task, etc.) and draw a graph

		task.visible = matchesFilters(task, currentFilters);

	};





	/*

	const onSaveTask = (task) => {
		console.log(`save here: ${JSON.stringify(task)}`);
		setTaskInForm(undefined);
	};

	const onDeleteTask = (taskId) => {
		console.log(`delete here: ${JSON.stringify(taskId)}`);
		setTaskInForm(undefined);
	};

	const onCloseModal = () => {
		setTaskInForm(undefined);
	};

	const onStartAddingTask = () => {
		setTaskInForm({ ...DEFAULT_TASK });
	};

	const onStartEditingTask = (task) => {
		setTaskInForm({ ...task });
	};

	*/

	return (
		<div>
			{/*taskInForm && <TaskFormModal initialTask={taskInForm} onSave={onSaveTask} onDiscard={onCloseModal} onDelete={onDeleteTask}/>*/}
			<TasksList tasks={SAMPLE_RAW_INPUT_TASKS} onStartEditingTask={() => {}} showAddTaskButton={true} onStartAddingTask={() => {}}/>
		</div>
	);
};

export default TasksContainer;
