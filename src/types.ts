import type { CSSProperties, Dispatch, SetStateAction } from 'react';

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

export type TaskChange = Partial<Task>;

export interface TasksContainer {
	active: Task[];
	completed: Task[];
}

export interface DomainEntry {
	key: string;
	value: string;
	label: string;
	color?: string;
	persistent: boolean;
	count: number;
}

export interface FilterDomains {
	priorities: DomainEntry[];
	owners: DomainEntry[];
	dueDates: DomainEntry[];
	tags: DomainEntry[];
}

export interface FormDomains {
	priorities: DomainEntry[];
	owners: DomainEntry[];
	tags: DomainEntry[];
}

export interface DomainsContainer {
	filters: FilterDomains;
	form: FormDomains;
}

export interface TaskFilters {
	text: string;
	owners: string[];
	dueDates: string[];
	priorities: TaskPriorityValue[];
	tags: string[];
	showCompleted: boolean;
}

export type TaskFilterChange = Partial<TaskFilters>;

export interface TaskStateContainer {
	tasksContainer: TasksContainer;
	domainsContainer: DomainsContainer;
	filters: TaskFilters;
}

export type SetTaskState = Dispatch<SetStateAction<TaskStateContainer>>;

export interface CurrentDateLabel {
	date: Date;
	label: string;
}

export interface CurrentDates {
	today: CurrentDateLabel;
	yesterday: CurrentDateLabel;
	tomorrow: CurrentDateLabel;
	fiveDaysAfterTomorrow: CurrentDateLabel[];
	nextWorkingDay: CurrentDateLabel;
}

export type IconProps = {
	className?: string;
	style?: CSSProperties;
};
