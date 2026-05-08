import 'src/components/tasks/Task.css';
import { useState, useRef, useEffect, type ReactElement } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { TextArea } from 'src/components/inputs/TextArea';
import type { FormDomains } from 'src/types/DomainTypes';
import type { Task as TaskType, TaskChange } from 'src/types/TaskTypes';
import { TaskPriority } from 'src/components/tasks/TaskPriority';
import { TaskActions } from 'src/components/tasks/TaskActions';
import { TaskChips } from 'src/components/tasks/TaskChips';

type TaskProps = {
	id: string;
	index: number;
	task: TaskType;
	inputDomains: FormDomains;
	onSave: (changedValues: TaskChange) => void;
	onDelete: () => void;
};

type SetTaskValue = <TKey extends keyof TaskType>(key: TKey, valueOrCallback: TaskType[TKey] | ((prevValue: TaskType[TKey]) => TaskType[TKey]), flush: boolean) => void;

const Task = ({ id, index, task: taskFromProps, inputDomains, onSave: onSaveFromProps, onDelete }: TaskProps): ReactElement => {
	// Internal copy of the task, for delayed changes propagation to the parent component (main state)
	const [ internalTask, setInternalTask ] = useState(taskFromProps);
	const {
		text,
		state,
		priority
	} = internalTask;

	// Temporary state for new tags
	const [ newTag, setNewTag ] = useState('');

	// Ref with the changed task values (a ref is required for the timer/unmount callbacks because state may not be completely updated)
	const changedValuesRef = useRef<TaskChange>({});

	// Ref with the latest version of onSave callback (same reason as above)
	const onSaveRef = useRef(onSaveFromProps);
	useEffect(() => {
		onSaveRef.current = onSaveFromProps;
	}, [ onSaveFromProps ]);

	// Timer that flushes changes back to the parent component with a delay
	const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Sortable hook
	const { ref, handleRef } = useSortable({ id, index });

	// Helper to stop the flush timer
	const clearFlushTimer = (): void => {
		if(flushTimerRef.current) {
			clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
		}
	};

	// Helper to flush any change to the parent component (main state)
	const flushTaskChanges = (): void => {
		clearFlushTimer();
		if(Object.keys(changedValuesRef.current).length !== 0) {
			const changesToFlush = changedValuesRef.current;
			changedValuesRef.current = {};
			onSaveRef.current(changesToFlush);
		}
	};

	// Helper to (re)start the flush timer
	const restartFlushTimer = (): void => {
		clearFlushTimer();
		flushTimerRef.current = setTimeout(flushTaskChanges, 5000);
	};

	// Helper to update both state and ref when task values change, (re)set the flush timer and (optionally) flush any pending changes afterwards
	const setTaskValue: SetTaskValue = (key, valueOrCallback, flush) => {
		setInternalTask((prevInternalTask) => {
			const newValue = typeof valueOrCallback === 'function' ? valueOrCallback(prevInternalTask[key]) : valueOrCallback;
			changedValuesRef.current = {
				...changedValuesRef.current,
				[key]: newValue
			};
			if(flush) {
				flushTaskChanges();
			}
			else {
				restartFlushTimer();
			}
			return { ...prevInternalTask, [key]: newValue };
		});
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
		return flushTaskChanges;
	});

	// Dynamic container class
	let containerClass = 'task-container';
	if(state) {
		containerClass += ` task-container-${state.toLowerCase()}`;
	}

	return (
		<div ref={ref} className={containerClass}>
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
			/>
			<span ref={handleRef}>MOVE P = {internalTask.sortPosition}, I = {index}</span>
		</div>
	);
};

export { Task };
