import 'src/components/tasks/Task.css';
import { useState, useRef, useEffect, useCallback, type CSSProperties, type ReactElement } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { TASKS_CONFIG } from 'src/config/AppConfig';
import { registerPendingTaskChangesFlushListener } from 'src/logic/PendingTaskChanges';
import { TextArea } from 'src/components/inputs/TextArea';
import type { FormDomains } from 'src/types/DomainTypes';
import type { Task as TaskType, TaskChange } from 'src/types/TaskTypes';
import { TaskPriority } from 'src/components/tasks/TaskPriority';
import { TaskActions } from 'src/components/tasks/TaskActions';
import { TaskChips } from 'src/components/tasks/TaskChips';
import { TaskDragHandle } from 'src/components/tasks/TaskDragHandle';

type TaskProps = {
	id: string;
	index: number;
	task: TaskType;
	inputDomains: FormDomains;
	onSave: (changedValues: TaskChange) => void;
	onDelete: () => void;
	showDragHandle: boolean;
};

type SetTaskValue = <TKey extends keyof TaskType>(key: TKey, valueOrCallback: TaskType[TKey] | ((prevValue: TaskType[TKey]) => TaskType[TKey]), flush: boolean) => void;
type TaskValueUpdater<TKey extends keyof TaskType> = (prevValue: TaskType[TKey]) => TaskType[TKey];
type TaskContainerStyle = CSSProperties & {
	'--task-state-change-delay': string;
};

const Task = ({ id, index, task: taskFromProps, inputDomains, onSave: onSaveFromProps, onDelete, showDragHandle }: TaskProps): ReactElement => {
	// Internal copy of the task, for delayed changes propagation to the parent component (main state)
	const [ internalTask, setInternalTask ] = useState(taskFromProps);
	const internalTaskRef = useRef(taskFromProps);
	const {
		text,
		state,
		priority
	} = internalTask;

	// Temporary state for new tags (the ref mirrors it for the unmount callbacks)
	const [ newTag, setNewTagState ] = useState('');
	const newTagRef = useRef('');

	// Ref with the changed task values (a ref is required for the timer/unmount callbacks because state may not be completely updated)
	const changedValuesRef = useRef<TaskChange>({});

	// Set when the task is deleted, so that buffered changes are discarded instead of being saved on a task that no longer exists
	const isDiscardedRef = useRef(false);

	// Ref with the latest version of onSave callback (same reason as above)
	const onSaveRef = useRef(onSaveFromProps);
	useEffect(() => {
		onSaveRef.current = onSaveFromProps;
	}, [ onSaveFromProps ]);

	// Timer that flushes changes back to the parent component with a delay
	const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const isStateChangePending = state !== taskFromProps.state;

	// Sortable hook
	const { ref, handleRef } = useSortable({
		id,
		index,
		disabled: isStateChangePending
	});

	// Helper to stop the flush timer
	const clearFlushTimer = useCallback((): void => {
		if(flushTimerRef.current) {
			clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}
	}, []);

	// Helper to flush any change to the parent component (main state)
	const flushTaskChanges = useCallback((): void => {
		clearFlushTimer();
		if(!isDiscardedRef.current && Object.keys(changedValuesRef.current).length !== 0) {
			const changesToFlush = changedValuesRef.current;
			changedValuesRef.current = {};
			onSaveRef.current(changesToFlush);
		}
	}, [ clearFlushTimer ]);

	// Helper to save everything the user typed when the task is going away (unmount) or the window is closing:
	// the tag that is still in the "new tag" input was never committed to the task, so it would be lost otherwise
	const flushTaskChangesOnTeardown = useCallback((): void => {
		const pendingNewTag = newTagRef.current.trim();
		if(pendingNewTag && !isDiscardedRef.current) {
			newTagRef.current = '';
			const currentTask = internalTaskRef.current;
			const newTags = [ ...currentTask.tags, pendingNewTag ];
			internalTaskRef.current = { ...currentTask, tags: newTags };
			changedValuesRef.current = { ...changedValuesRef.current, tags: newTags };
		}

		flushTaskChanges();
	}, [ flushTaskChanges ]);

	// Helper to (re)start the flush timer
	const restartFlushTimer = useCallback((flushDelayMs: number = TASKS_CONFIG.flushDelayMs): void => {
		clearFlushTimer();
		flushTimerRef.current = setTimeout(flushTaskChanges, flushDelayMs);
	}, [ clearFlushTimer, flushTaskChanges ]);

	// Helper to update both state and ref when task values change, reset the flush timer and optionally flush any pending changes afterwards
	const setTaskValue: SetTaskValue = (key, valueOrCallback, flush) => {
		const currentTask = internalTaskRef.current;
		const newValue = typeof valueOrCallback === 'function' ? (valueOrCallback as TaskValueUpdater<typeof key>)(currentTask[key]) : valueOrCallback;
		const newTask = { ...currentTask, [key]: newValue };
		internalTaskRef.current = newTask;
		const changedValues = { ...changedValuesRef.current };
		if(newValue === taskFromProps[key]) {
			delete changedValues[key];
		}
		else {
			changedValues[key] = newValue;
		}
		changedValuesRef.current = changedValues;
		const isNewStatePending = key === 'state' && newValue !== taskFromProps.state;

		setInternalTask(newTask);
		if(flush) {
			flushTaskChanges();
		}
		else if(Object.keys(changedValuesRef.current).length !== 0) {
			restartFlushTimer(isNewStatePending ? TASKS_CONFIG.stateChangeDelayMs : TASKS_CONFIG.flushDelayMs);
		}
		else {
			clearFlushTimer();
		}
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
		newTagRef.current = value;
		setNewTagState(value);
	};

	// Buffered changes are meaningless once the task is deleted, and saving them would fail on a task row that no longer exists
	const discardTaskChangesAndDelete = (): void => {
		isDiscardedRef.current = true;
		changedValuesRef.current = {};
		newTagRef.current = '';
		clearFlushTimer();
		onDelete();
	};

	// When the parent replaces the task (e.g. a bulk update or a reload from the database), adopt its values but keep any change the user did not save yet
	const lastTaskFromPropsRef = useRef(taskFromProps);
	useEffect(() => {
		if(lastTaskFromPropsRef.current === taskFromProps) {
			return;
		}

		lastTaskFromPropsRef.current = taskFromProps;
		const newTask = {
			...taskFromProps,
			...changedValuesRef.current
		};
		internalTaskRef.current = newTask;
		setInternalTask(newTask);
	}, [ taskFromProps ]);

	// On component unmount, flush any pending change
	useEffect(() => {
		return flushTaskChangesOnTeardown;
	}, [ flushTaskChangesOnTeardown ]);

	// The renderer is destroyed without unmounting when the window is closed, so pending changes must be flushed here too
	useEffect(() => {
		window.addEventListener('pagehide', flushTaskChangesOnTeardown);

		return () => {
			window.removeEventListener('pagehide', flushTaskChangesOnTeardown);
		};
	}, [ flushTaskChangesOnTeardown ]);

	// The main process asks for pending changes before it closes the database on quit
	useEffect(() => {
		return registerPendingTaskChangesFlushListener(flushTaskChangesOnTeardown);
	}, [ flushTaskChangesOnTeardown ]);

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
		borderLeftColor: `var(--colors-priority-${internalTask.priority.toLowerCase()})`,
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
					task={internalTask}
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
				task={internalTask}
				onChangeState={() => {
					// Change state and flush it after the exit animation unless it is reverted first
					setTaskValue('state', state === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE', false);
				}}
				onDelete={discardTaskChangesAndDelete}
				dragHandle={dragHandle}
				disableSecondaryActions={isStateChangePending}
			/>
		</div>
	);
};

export { Task };
