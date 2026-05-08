import type { TaskPriorityValue } from 'src/types/TaskTypes';

export interface TaskFilters {
	text: string;
	owners: string[];
	dueDates: string[];
	priorities: TaskPriorityValue[];
	tags: string[];
	showCompleted: boolean;
}

export type TaskFilterChange = Partial<TaskFilters>;
