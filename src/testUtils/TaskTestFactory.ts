import type { DomainEntry, FormDomains } from 'src/types/DomainTypes';
import type { Task, TaskPriorityValue } from 'src/types/TaskTypes';

let nextTaskId = 1;

export const makeTask = (overrides: Partial<Task> = {}): Task => {
	const taskId = nextTaskId;
	nextTaskId += 1;

	return {
		id: `task-${taskId}`,
		text: `Task ${taskId}`,
		state: 'ACTIVE',
		priority: 'NORMAL',
		owner: undefined,
		dueDate: undefined,
		tags: [],
		sortPosition: taskId * 100,
		visible: false,
		completionDate: undefined,
		...overrides
	};
};

export const taskIds = (tasks: Task[]): string[] => {
	return tasks.map((task) => {
		return task.id;
	});
};

const makePriorityDomain = (priority: TaskPriorityValue): DomainEntry => {
	return {
		key: priority.toLowerCase(),
		value: priority,
		label: priority[0] + priority.slice(1).toLowerCase(),
		color: `var(--colors-priority-${priority.toLowerCase()})`,
		persistent: true,
		count: 0
	};
};

const makeDomain = (value: string, label = value): DomainEntry => {
	return {
		key: value || 'empty',
		value,
		label,
		color: undefined,
		persistent: value === '',
		count: 0
	};
};

export const makeFormDomains = (): FormDomains => {
	return {
		priorities: [
			makePriorityDomain('URGENT'),
			makePriorityDomain('HIGH'),
			makePriorityDomain('NORMAL'),
			makePriorityDomain('LOW')
		],
		owners: [
			makeDomain('', 'Me'),
			makeDomain('Alice'),
			makeDomain('Bob')
		],
		tags: [
			makeDomain('work'),
			makeDomain('home')
		]
	};
};
