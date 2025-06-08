import { getInitialDomains, cloneDomains, addDomainsForTasks, removeDomainsForTask, updateDomainsForTask, addDomainsForTask, updateFiltersOnDomainsChange } from './DomainsLogic';
import { getInitialTasks, cloneTasks, loadBackEndTasks, saveNewTask, deleteTask, updateTask } from './TasksLogic';
import { cloneFilters, getInitialFilters, refreshTasksVisibility, refreshTaskVisibility } from './FiltersLogic';
import { DateUtils } from '../utils/DateUtils';

const SAMPLE_INPUT_TASKS = [
	{
		id: 'd4e92b5e-6879-4c49-bb76-3c7af2a0cbf2',
		text: 'Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries. Buy groceries.',
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: 'Alice',
		dueDate: DateUtils.toStandardYearMonthDay(new Date('2025-11-12')),
		tags: [ 'shopping', 'errands' ],
		sortPosition: 0
	},
	{
		id: '85eeb930-1b29-4b6c-8f33-6a5161b57a60',
		text: 'Finish project report.\nAnd then send report.\n\nThis is another line.\nAnd another.',
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: 'Bob',
		dueDate: DateUtils.toStandardYearMonthDay(new Date(new Date().setHours(0, 0, 0, 0))),
		tags: [ 'work' ],
		sortPosition: 100
	},
	{
		id: 'f624563c-0e6a-4c1e-bb7c-885e46be4998',
		text: 'Call the plumber',
		state: 'COMPLETED',
		completionDate: new Date('2024-06-01'),
		priority: 'LOW',
		tags: [ 'home' ],
		sortPosition: 200
	},
	{
		id: '70a58f3f-c82b-4f70-901b-b91785b4af01',
		text: '',
		state: 'ACTIVE',
		priority: 'URGENT',
		owner: 'Alice',
		tags: [ 'health' ],
		sortPosition: 300
	},
	{
		id: '1c2a8d5a-e5b2-4c73-8bdc-70458c5ae321',
		text: 'Plan weekend trip',
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: 'Charlie',
		dueDate: DateUtils.toStandardYearMonthDay(new Date('2024-01-19')),
		tags: [ 'travel' ],
		sortPosition: 400
	},
	{
		id: '3fd9be50-c51d-4fd1-a8c1-4b351cfd76f9',
		text: 'Send invitations for birthday party',
		state: 'COMPLETED',
		completionDate: new Date('2024-03-01'),
		priority: 'HIGH',
		tags: [ 'party', 'personal' ],
		sortPosition: 500
	},
	{
		id: '9b62f7de-2b65-432c-8675-4867a0e3c71c',
		text: 'Prepare for team meeting',
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: 'Bob',
		tags: [ 'work' ],
		sortPosition: 600
	},
	{
		id: 'dd7300de-065c-4c73-bd98-419aefc66c9f',
		text: 'Clean the garage',
		state: 'ACTIVE',
		priority: 'URGENT',
		tags: [ 'home', 'chores' ],
		sortPosition: 700
	},
	{
		id: '11af6ed8-29f3-4e37-a1a2-4bc6a5749cb6',
		text: 'Book flight tickets',
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: 'Charlie',
		tags: [ 'travel', 'urgent' ],
		sortPosition: 800
	},
	{
		id: 'b73f0208-bb2e-426c-b654-d362ace38e72',
		text: 'Research new laptop models',
		state: 'ACTIVE',
		priority: 'NORMAL',
		tags: [],
		sortPosition: 900
	},
	{
		id: 'a1c4c59f-d272-4b29-a8d7-815db5de2899',
		text: 'Walk the dog',
		state: 'ACTIVE',
		priority: 'LOW',
		owner: 'John',
		dueDate: DateUtils.toStandardYearMonthDay(new Date('2024-01-19')),
		tags: [ 'pets', 'exercise' ],
		sortPosition: 1000
	},
	{
		id: 'c87f4a31-4696-4982-bd2c-cd48de8f0cf3',
		text: 'Organize bookshelves',
		state: 'COMPLETED',
		completionDate: new Date('2024-05-01'),
		priority: 'LOW',
		tags: [ 'home' ],
		sortPosition: 1100
	},
	{
		id: 'f5b2d93a-b1d7-4f70-9c96-12f9ec8d1e73',
		text: 'Submit tax documents',
		state: 'ACTIVE',
		priority: 'URGENT',
		owner: 'Jane',
		dueDate: DateUtils.toStandardYearMonthDay(new Date('2025-11-20')),
		tags: [ 'finance', 'important' ],
		sortPosition: 1200
	},
	{
		id: '3b4587b7-6d61-4b4e-859b-05e0a6a32261',
		text: 'Prepare presentation slides',
		state: 'ACTIVE',
		priority: 'HIGH',
		owner: 'Emily',
		dueDate: DateUtils.toStandardYearMonthDay(new Date('2025-01-23')),
		tags: [ 'work' ],
		sortPosition: 1300
	},
	{
		id: 'a4c57919-16ef-46af-aadd-d233935fd24a',
		text: 'Water the plants',
		state: 'ACTIVE',
		priority: 'HIGH',
		tags: [ 'chores', 'home' ],
		sortPosition: 1400
	},
	{
		id: '92edc91a-d98c-4a66-b45f-2a7ae0cc79a3',
		text: 'Pick up dry cleaning',
		state: 'COMPLETED',
		completionDate: new Date('2024-01-01'),
		priority: 'LOW',
		owner: 'John',
		dueDate: DateUtils.toStandardYearMonthDay(new Date('2023-01-23')),
		tags: [ 'errands' ],
		sortPosition: 1500
	},
	{
		id: 'be38d889-70de-4621-9fbf-295e5c90338b',
		text: 'Write thank-you notes',
		state: 'ACTIVE',
		priority: 'NORMAL',
		tags: [ 'personal' ],
		sortPosition: 1600
	},
	{
		id: '0eb67958-6c03-4b3f-a99b-b4b012ccf8c4',
		text: 'Review contract details',
		state: 'ACTIVE',
		priority: 'URGENT',
		owner: 'Jane',
		dueDate: DateUtils.toStandardYearMonthDay(new Date('2025-01-25')),
		tags: [ 'work' ],
		sortPosition: 1700
	},
	{
		id: 'de6b1e97-d46b-420c-8cc1-f0c69bfb116e',
		text: 'Plan family dinner menu',
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: 'Emily',
		tags: [ 'family', 'food' ],
		sortPosition: 1800
	},
	{
		id: '72b2e08e-1c4e-42ba-89a2-56b324eb4b12',
		text: 'Fix the leaky faucet',
		state: 'ACTIVE',
		priority: 'LOW',
		tags: [ 'home', 'repair' ],
		sortPosition: 1900
	}
];

export const getInitialTaskState = () => {
	return {
		tasksContainer: getInitialTasks(),
		domainsContainer: getInitialDomains(),
		filters: getInitialFilters()
	};
};

export const onLoadBackEndTasks = (setTaskState) => {
	setTaskState((prevTaskState) => {
		const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
		const newDomainsContainer = cloneDomains(prevTaskState.domainsContainer);

		loadBackEndTasks(newTasksContainer, SAMPLE_INPUT_TASKS);
		addDomainsForTasks(newDomainsContainer, newTasksContainer);
		refreshTasksVisibility(newTasksContainer, prevTaskState.filters, prevTaskState.filters);

		return {
			tasksContainer: newTasksContainer,
			domainsContainer: newDomainsContainer,
			filters: prevTaskState.filters
		};
	});
};

export const onAddNewTask = (setTaskState, task) => {
	setTaskState((prevTaskState) => {
		const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
		const newDomainsContainer = cloneDomains(prevTaskState.domainsContainer);

		saveNewTask(newTasksContainer, task);
		addDomainsForTask(newDomainsContainer, task);
		refreshTaskVisibility(task, prevTaskState.filters);

		return {
			tasksContainer: newTasksContainer,
			domainsContainer: newDomainsContainer,
			filters: prevTaskState.filters
		};
	});
};

export const onUpdateTask = (setTaskState, oldTask, changedValues) => {
	setTaskState((prevTaskState) => {
		const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
		const newDomainsContainer = cloneDomains(prevTaskState.domainsContainer);
		const newFilters = cloneFilters(prevTaskState.filters);

		const newTask = updateTask(newTasksContainer, oldTask, changedValues);
		updateDomainsForTask(newDomainsContainer, oldTask, newTask, changedValues);
		updateFiltersOnDomainsChange(newDomainsContainer.filters, newFilters);
		refreshTaskVisibility(newTask, newFilters);

		return {
			tasksContainer: newTasksContainer,
			domainsContainer: newDomainsContainer,
			filters: newFilters
		};
	});
};

export const onDeleteTask = (setTaskState, task) => {
	setTaskState((prevTaskState) => {
		const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
		const newDomainsContainer = cloneDomains(prevTaskState.domainsContainer);
		const newFilters = cloneFilters(prevTaskState.filters);

		deleteTask(newTasksContainer, task);
		removeDomainsForTask(newDomainsContainer, task);
		updateFiltersOnDomainsChange(newDomainsContainer.filters, newFilters);

		return {
			tasksContainer: newTasksContainer,
			domainsContainer: newDomainsContainer,
			filters: newFilters
		};
	});
};

export const onFilterChange = (setTaskState, changedFilters) => {
	setTaskState((prevTaskState) => {
		const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
		const newFilters = {
			...prevTaskState.filters,
			...changedFilters
		};

		refreshTasksVisibility(newTasksContainer, prevTaskState.filters, newFilters);

		return {
			tasksContainer: newTasksContainer,
			domainsContainer: prevTaskState.domainsContainer,
			filters: newFilters
		};
	});
};

export const onResetDefaultFilters = (setTaskState) => {
	setTaskState((prevTaskState) => {
		const newTasksContainer = cloneTasks(prevTaskState.tasksContainer);
		const newFilters = getInitialFilters();

		refreshTasksVisibility(newTasksContainer, prevTaskState.filters, newFilters);

		return {
			tasksContainer: newTasksContainer,
			domainsContainer: prevTaskState.domainsContainer,
			filters: newFilters
		};
	});
};
