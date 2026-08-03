import 'src/components/tasks/Task.css';
import { useCallback, useSyncExternalStore, type CSSProperties, type ReactElement } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { TASKS_CONFIG } from 'src/config/AppConfig';
import { changePendingNewTag, changePendingTaskValue, flushPendingTaskChangesForTask, getPendingTaskChanges, subscribeToPendingTaskChanges } from 'src/logic/PendingTaskChanges';
import { TextArea } from 'src/components/inputs/TextArea';
import type { FormDomains } from 'src/types/DomainTypes';
import type { Task as TaskType } from 'src/types/TaskTypes';
import { TaskPriority } from 'src/components/tasks/TaskPriority';
import { TaskActions } from 'src/components/tasks/TaskActions';
import { TaskChips } from 'src/components/tasks/TaskChips';
import { TaskDragHandle } from 'src/components/tasks/TaskDragHandle';

type TaskProps = {
	id: string;
	index: number;
	task: TaskType;
	inputDomains: FormDomains;
	onDelete: () => void;
	showDragHandle: boolean;
};

type SetTaskValue = <TKey extends keyof TaskType>(key: TKey, valueOrUpdater: TaskType[TKey] | ((previousValue: TaskType[TKey]) => TaskType[TKey]), flush: boolean) => void;
type TaskContainerStyle = CSSProperties & {
	'--task-state-change-delay': string;
};

const Task = ({ id, index, task: taskFromProps, inputDomains, onDelete, showDragHandle }: TaskProps): ReactElement => {
	// The task changes the user did not save yet live outside this component, so that they survive filtering, re-renders and unmounts
	const subscribeToChanges = useCallback((onChange: () => void) => {
		return subscribeToPendingTaskChanges(id, onChange);
	}, [ id ]);
	const readChanges = useCallback(() => {
		return getPendingTaskChanges(id);
	}, [ id ]);
	const pendingChanges = useSyncExternalStore(subscribeToChanges, readChanges);

	// The displayed task is always the task state plus the buffered changes, so the two can never drift apart
	const task = pendingChanges ? { ...taskFromProps, ...pendingChanges.change } : taskFromProps;
	const newTag = pendingChanges ? pendingChanges.newTag : '';
	const {
		text,
		state,
		priority
	} = task;

	const isStateChangePending = state !== taskFromProps.state;

	// Sortable hook
	const { ref, handleRef } = useSortable({
		id,
		index,
		disabled: isStateChangePending
	});

	const flushTaskChanges = (): void => {
		flushPendingTaskChangesForTask(id);
	};

	const setTaskValue: SetTaskValue = (key, valueOrUpdater, flush) => {
		changePendingTaskValue(taskFromProps, key, valueOrUpdater, flush);
	};

	const setOwner = (owner: string, flush: boolean): void => {
		setTaskValue('owner', owner, flush);
	};

	const setDueDate = (dueDate: string, flush: boolean): void => {
		setTaskValue('dueDate', dueDate, flush);
	};

	const setTags = (changeTags: (prevTags: string[]) => string[], flush: boolean): void => {
		setTaskValue('tags', changeTags, flush);
	};

	const setNewTag = (value: string): void => {
		changePendingNewTag(id, value);
	};

	// Dynamic container class
	let containerClass = 'task-container';
	if(state) {
		containerClass += ` task-container-${state.toLowerCase()}`;
	}
	if(isStateChangePending) {
		containerClass += ' task-container-state-changing';
	}

	const dragHandle = showDragHandle ? <TaskDragHandle ref={handleRef} disabled={isStateChangePending}/> : undefined;
	const containerStyle: TaskContainerStyle = {
		borderLeftColor: `var(--colors-priority-${priority.toLowerCase()})`,
		'--task-state-change-delay': `${TASKS_CONFIG.stateChangeDelayMs}ms`
	};

	return (
		<div ref={ref} className={containerClass} style={containerStyle}>
			<TaskPriority
				priorityDomain={inputDomains.priorities}
				value={priority}
				disabled={isStateChangePending}
				onChange={(value) => {
					setTaskValue('priority', value, false);
				}}
				onBlur={flushTaskChanges}
			/>
			<div className='task-content'>
				<TextArea
					placeholder={'Add content...'}
					value={text}
					onChange={(value) => {
						setTaskValue('text', value, false);
					}}
					onBlur={flushTaskChanges}
					disabled={isStateChangePending}
				/>
				<TaskChips
					inputDomains={inputDomains}
					task={task}
					setOwner={setOwner}
					setDueDate={setDueDate}
					setTags={setTags}
					flushTaskChanges={flushTaskChanges}
					newTag={newTag}
					setNewTag={setNewTag}
					disabled={isStateChangePending}
				/>
			</div>
			<TaskActions
				task={task}
				onChangeState={() => {
					// Change state and flush it after the exit animation unless it is reverted first
					setTaskValue('state', state === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE', false);
				}}
				onDelete={onDelete}
				dragHandle={dragHandle}
				disableSecondaryActions={isStateChangePending}
			/>
		</div>
	);
};

export { Task };
