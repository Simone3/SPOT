import 'src/components/tasks/TasksList.css';
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import type { ReactElement } from 'react';
import { AddIcon } from 'src/components/icons/AddIcon';
import { RefreshIcon } from 'src/components/icons/RefreshIcon';
import { SortIcon } from 'src/components/icons/SortIcon';
import { Header, type HeaderAction } from 'src/components/common/Header';
import type { FormDomains } from 'src/types/DomainTypes';
import type { Task as TaskType } from 'src/types/TaskTypes';
import { Task } from 'src/components/tasks/Task';
import { useTranslator } from 'src/i18n/TranslationContext';

type TasksListProps = {
	title: string;
	tasks: TaskType[];
	inputDomains: FormDomains;
	onRefreshTasks?: () => void;
	onMoveTask?: (fromIndex: number, toIndex: number) => void;
	onSortTasksByImportance?: () => void;
	onAddNewTask?: () => void;
	onDeleteTask: (task: TaskType) => void;
	showActions: boolean;
};

const TasksList = ({ title, tasks, inputDomains, onRefreshTasks, onMoveTask, onSortTasksByImportance, onAddNewTask, onDeleteTask, showActions }: TasksListProps): ReactElement => {
	const { t } = useTranslator();
	const visibleTasks: TaskType[] = [];
	const originalIndices: number[] = [];
	for(let i = 0; i < tasks.length; i++) {
		if(tasks[i].visible) {
			visibleTasks.push(tasks[i]);
			originalIndices.push(i);
		}
	}

	const onDragEnd = (event: DragEndEvent): void => {
		if(!onMoveTask || event.canceled) {
			return;
		}

		const { source } = event.operation;
		if(isSortable(source)) {
			const { initialIndex, index } = source;
			if(initialIndex !== index) {
				onMoveTask(originalIndices[initialIndex], originalIndices[index]);
			}
		}
	};

	const actions: HeaderAction[] = [];
	if(showActions) {
		actions.push({
			id: 'refresh',
			icon: <RefreshIcon />,
			label: t('tasks.actions.refresh'),
			onClick: onRefreshTasks!
		}, {
			id: 'sort',
			icon: <SortIcon />,
			label: t('tasks.actions.sortByImportance'),
			onClick: onSortTasksByImportance!
		}, {
			id: 'add',
			icon: <AddIcon />,
			label: t('tasks.actions.add'),
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
						showDragHandle={Boolean(onMoveTask)}
						onDelete={() => {
							onDeleteTask(task);
						}}
					/>;
				})
				}
			</DragDropProvider>
			{visibleTasks.length === 0 && <div className='tasks-list-empty-message'>{t('tasks.emptyList')}</div>}
		</div>
	);
};

export { TasksList };
