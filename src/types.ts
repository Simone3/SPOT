import type { CSSProperties, Dispatch, SetStateAction } from 'react';

export type TaskStatus = 'ACTIVE' | 'COMPLETED';

export type TaskPriorityValue = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export type TaskDomainValue = string | undefined;

export type TaskDueDate = string | undefined;

export type TaskOwner = string | undefined;

export type TaskTag = string;

export interface Task {
	id: string;
	text: string;
	state: TaskStatus;
	priority: TaskPriorityValue;
	owner?: TaskOwner;
	dueDate?: TaskDueDate;
	tags: TaskTag[];
	sortPosition: number;
	visible: boolean;
	completionDate?: Date;
}

export type TaskChange = Partial<Task>;

export interface TasksContainer {
	active: Task[];
	completed: Task[];
}

export interface DomainEntry<TValue extends TaskDomainValue = TaskDomainValue> {
	key: string;
	value: TValue;
	label: string;
	color?: string;
	persistent: boolean;
	count: number;
}

export interface FilterDomains {
	priorities: DomainEntry<TaskPriorityValue>[];
	owners: DomainEntry<TaskOwner>[];
	dueDates: DomainEntry<TaskDueDate>[];
	tags: DomainEntry<TaskTag>[];
}

export interface FormDomains {
	priorities: DomainEntry<TaskPriorityValue>[];
	owners: DomainEntry<TaskOwner>[];
	tags: DomainEntry<TaskTag>[];
}

export interface DomainsContainer {
	filters: FilterDomains;
	form: FormDomains;
}

export interface TaskFilters {
	text: string;
	owners: TaskOwner[];
	dueDates: TaskDueDate[];
	priorities: TaskPriorityValue[];
	tags: TaskTag[];
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
