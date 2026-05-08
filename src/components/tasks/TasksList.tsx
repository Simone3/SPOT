import './TasksList.css';
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import type { ReactElement } from 'react';
import AddIcon from '../icons/AddIcon';
import RefreshIcon from '../icons/RefreshIcon';
import SortIcon from '../icons/SortIcon';
import Header, { type HeaderAction } from '../common/Header';
import type { FormDomains } from '../../types/DomainTypes';
import type { Task as TaskType, TaskChange } from '../../types/TaskTypes';
import Task from './Task';

type DragEndEventPayload = Parameters<DragEndEvent>[0];

type TasksListProps = {
	title: string;
	tasks: TaskType[];
	inputDomains: FormDomains;
	onRefreshTasks?: () => void;
	onMoveTask?: (fromIndex: number, toIndex: number) => void;
	onSortTasksByImportance?: () => void;
	onAddNewTask?: () => void;
	onUpdateTask: (oldTask: TaskType, changedValues: TaskChange) => void;
	onDeleteTask: (task: TaskType) => void;
	showActions: boolean;
};

const TasksList = ({ title, tasks, inputDomains, onRefreshTasks, onMoveTask, onSortTasksByImportance, onAddNewTask, onUpdateTask, onDeleteTask, showActions }: TasksListProps): ReactElement => {
	const visibleTasks: TaskType[] = [];
	const originalIndices: number[] = [];
	for(let i = 0; i < tasks.length; i++) {
		if(tasks[i].visible) {
			visibleTasks.push(tasks[i]);
			originalIndices.push(i);
		}
	}

	const onDragEnd = (event: DragEndEventPayload): void => {
		if(event.canceled) {
			return;
		}

		const { source } = event.operation;
		if(isSortable(source)) {
			const { initialIndex, index } = source;
			if(initialIndex !== index) {
				onMoveTask!(originalIndices[initialIndex], originalIndices[index]);
			}
		}
	};

	const actions: HeaderAction[] = [];
	if(showActions) {
		actions.push({
			id: 'refresh',
			icon: <RefreshIcon />,
			label: 'Refresh',
			onClick: onRefreshTasks!
		}, {
			id: 'sort',
			icon: <SortIcon />,
			label: 'Sort by importance',
			onClick: onSortTasksByImportance!
		}, {
			id: 'add',
			icon: <AddIcon />,
			label: 'Add task',
			onClick: onAddNewTask!
		});
	}

	return (
		<div className='tasks-list-container'>
			<Header
				title={title}
				actions={actions}
			/>
			<DragDropProvider onDragEnd={onDragEnd}>
				{visibleTasks.map((task, index) => {
					return <Task
						id={task.id}
						key={task.id}
						index={index}
						task={task}
						inputDomains={inputDomains}
						onSave={(changedValues: TaskChange) => {
							onUpdateTask(task, changedValues);
						}}
						onDelete={() => {
							onDeleteTask(task);
						}}
					/>;
				})
				}
			</DragDropProvider>
			{visibleTasks.length === 0 && <div className='tasks-list-empty-message'>No task found! Change the current filters or create new tasks.</div>}
		</div>
	);
};

export default TasksList;
