import 'src/components/tasks/Task.css';
import { useState, useRef, useEffect, useCallback, type CSSProperties, type ReactElement } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
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
type FlushFeedbackState = 'idle' | 'pending' | 'flushed';
type TaskContainerStyle = CSSProperties & {
	'--task-flush-delay': string;
};

const FLUSH_DELAY_MS = 5000;
const FLUSHED_FEEDBACK_MS = 700;

const Task = ({ id, index, task: taskFromProps, inputDomains, onSave: onSaveFromProps, onDelete, showDragHandle }: TaskProps): ReactElement => {
	// Internal copy of the task, for delayed changes propagation to the parent component (main state)
	const [ internalTask, setInternalTask ] = useState(taskFromProps);
	const internalTaskRef = useRef(taskFromProps);
	const {
		text,
		state,
		priority
	} = internalTask;

	// Temporary state for new tags
	const [ newTag, setNewTag ] = useState('');

	// Ambient save feedback state for buffered changes
	const [ flushFeedbackState, setFlushFeedbackState ] = useState<FlushFeedbackState>('idle');
	const [ flushFeedbackAnimationKey, setFlushFeedbackAnimationKey ] = useState(0);

	// Ref with the changed task values (a ref is required for the timer/unmount callbacks because state may not be completely updated)
	const changedValuesRef = useRef<TaskChange>({});

	// Ref with the latest version of onSave callback (same reason as above)
	const onSaveRef = useRef(onSaveFromProps);
	useEffect(() => {
		onSaveRef.current = onSaveFromProps;
	}, [ onSaveFromProps ]);

	// Timer that flushes changes back to the parent component with a delay
	const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const flushFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sortable hook
	const { ref, handleRef } = useSortable({ id, index });

	// Helper to stop the flush feedback timer
	const clearFlushFeedbackTimer = useCallback((): void => {
		if(flushFeedbackTimerRef.current) {
			clearTimeout(flushFeedbackTimerRef.current);
			flushFeedbackTimerRef.current = null;
		}
	}, []);

	// Helper to show that a save is pending and restart the progress animation
	const showPendingFlushFeedback = useCallback((): void => {
		clearFlushFeedbackTimer();
		setFlushFeedbackState('pending');
		setFlushFeedbackAnimationKey((currentKey) => {
			return currentKey + 1;
		});
	}, [ clearFlushFeedbackTimer ]);

	// Helper to briefly show that pending changes were flushed
	const showFlushedFeedback = useCallback((): void => {
		clearFlushFeedbackTimer();
		setFlushFeedbackState('flushed');
		flushFeedbackTimerRef.current = setTimeout(() => {
			flushFeedbackTimerRef.current = null;
			setFlushFeedbackState('idle');
		}, FLUSHED_FEEDBACK_MS);
	}, [ clearFlushFeedbackTimer ]);

	// Helper to stop the flush timer
	const clearFlushTimer = useCallback((): void => {
		if(flushTimerRef.current) {
			clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}
	}, []);

	// Helper to flush any change to the parent component (main state)
	const flushTaskChanges = useCallback((showFeedback = true): void => {
		clearFlushTimer();
		if(Object.keys(changedValuesRef.current).length !== 0) {
			const changesToFlush = changedValuesRef.current;
			changedValuesRef.current = {};
			onSaveRef.current(changesToFlush);
			if(showFeedback) {
				showFlushedFeedback();
			}
		}
	}, [ clearFlushTimer, showFlushedFeedback ]);

	// Helper to (re)start the flush timer
	const restartFlushTimer = useCallback((): void => {
		clearFlushTimer();
		showPendingFlushFeedback();
		flushTimerRef.current = setTimeout(flushTaskChanges, FLUSH_DELAY_MS);
	}, [ clearFlushTimer, flushTaskChanges, showPendingFlushFeedback ]);

	// Helper to update both state and ref when task values change, (re)set the flush timer and (optionally) flush any pending changes afterwards
	const setTaskValue: SetTaskValue = (key, valueOrCallback, flush) => {
		const currentTask = internalTaskRef.current;
		const newValue = typeof valueOrCallback === 'function' ? (valueOrCallback as TaskValueUpdater<typeof key>)(currentTask[key]) : valueOrCallback;
		const newTask = { ...currentTask, [key]: newValue };
		internalTaskRef.current = newTask;
		changedValuesRef.current = {
			...changedValuesRef.current,
			[key]: newValue
		};
		setInternalTask(newTask);
		if(flush) {
			flushTaskChanges();
		}
		else {
			restartFlushTimer();
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

	// On component unmount, flush any pending changes
	useEffect(() => {
		return () => {
			clearFlushFeedbackTimer();
			flushTaskChanges(false);
		};
	}, [ clearFlushFeedbackTimer, flushTaskChanges ]);

	// Dynamic container class
	let containerClass = 'task-container';
	if(state) {
		containerClass += ` task-container-${state.toLowerCase()}`;
	}

	const dragHandle = showDragHandle ? <TaskDragHandle ref={handleRef}/> : undefined;
	const containerStyle: TaskContainerStyle = {
		borderLeftColor: `var(--colors-priority-${internalTask.priority.toLowerCase()})`,
		'--task-flush-delay': `${FLUSH_DELAY_MS}ms`
	};

	return (
		<div ref={ref} className={containerClass} style={containerStyle}>
			<TaskPriority
				priorityDomain={inputDomains.priorities}
				value={priority}
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
				/>
			</div>
			<TaskActions
				task={internalTask}
				onChangeState={() => {
					// Change state and immediately flush it to parent component
					setTaskValue('state', state === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE', true);
				}}
				onDelete={onDelete}
				dragHandle={dragHandle}
			/>
			{flushFeedbackState !== 'idle' &&
				<div className={`task-flush-feedback task-flush-feedback-${flushFeedbackState}`} aria-hidden='true'>
					{flushFeedbackState === 'pending' &&
						<div key={flushFeedbackAnimationKey} className='task-flush-progress'/>}
					{flushFeedbackState === 'flushed' &&
						<div className='task-flush-saved-dot'/>}
				</div>
			}
		</div>
	);
};

export { Task };
