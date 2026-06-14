export type TaskStatus = 'ACTIVE' | 'COMPLETED';

export type TaskPriorityValue = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export interface Task {
	id: string;
	text: string;
	state: TaskStatus;
	priority: TaskPriorityValue;
	owner?: string;
	dueDate?: string;
	tags: string[];
	sortPosition: number;
	visible: boolean;
	completionDate?: Date;
}

export type PersistedTask = Omit<Task, 'visible'>;

export type PersistedTaskChange = Partial<Omit<PersistedTask, 'id'>>;

export type TaskChange = Partial<Task>;

export interface TasksContainer {
	active: Task[];
	completed: Task[];
}
