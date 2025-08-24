import './Task.css';
import { useState, useRef, useEffect } from 'react';
import TextArea from '../inputs/TextArea';
import TaskPriority from './TaskPriority';
import TaskActions from './TaskActions';
import TaskChips from './TaskChips';

const Task = ({ task: taskFromProps, inputDomains, onSave: onSaveFromProps, onDelete }) => {
	// Internal copy of the task, for delayed changes propagation to main state
	const [ internalTask, setInternalTask ] = useState(taskFromProps);
	const {
		text,
		state,
		priority
	} = internalTask;

	// Temporary state for new tags
	const [ newTag, setNewTag ] = useState('');

	// Ref with the changed task values (a ref is required for the timeout/unmount callbacks because state may not be completely updated)
	const changedValuesRef = useRef({});

	// Ref with the latest version of onSave callback (same reason as above)
	const onSaveRef = useRef(onSaveFromProps);
	useEffect(() => {
		onSaveRef.current = onSaveFromProps;
	}, [ onSaveFromProps ]);

	// Helper to save the current task values
	const saveTaskIfNecessary = () => {
		if(Object.keys(changedValuesRef.current).length !== 0) {
			onSaveRef.current(changedValuesRef.current);
			changedValuesRef.current = {};
		}
	};

	// Timeout that flushes changes back to the parent component with a delay
	const timeoutRef = useRef(null);
	const clearTimeoutIfAny = () => {
		if(timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	};
	const resetTimeout = (callback) => {
		clearTimeoutIfAny();
		timeoutRef.current = setTimeout(() => {
			callback();
			timeoutRef.current = null;
		}, 5000);
	};

	// Helper to update both state and ref when task values change, and (re)set the save timeout
	const setTaskValue = (key, valueOrCallback) => {
		setInternalTask((prevInternalTask) => {
			const newValue = typeof valueOrCallback === 'function' ? valueOrCallback(prevInternalTask[key]) : valueOrCallback;
			changedValuesRef.current[key] = newValue;
			resetTimeout(saveTaskIfNecessary);
			return { ...prevInternalTask, [key]: newValue };
		});
	};
	
	// On component unmount, flush any pending changes
	useEffect(() => {
		return () => {
			clearTimeoutIfAny();
			saveTaskIfNecessary();
		};
	}, []);

	// Dynamic container class
	let containerClass = 'task-container';
	if(state) {
		containerClass += ` task-container-${state.toLowerCase()}`;
	}

	return (
		<div className={containerClass}>
			<TaskPriority
				priorityDomain={inputDomains.priorities}
				value={priority}
				onChange={(value) => {
					setTaskValue('priority', value);
				}}
			/>
			<div className='task-content'>
				<TextArea
					placeholder={'Add content...'}
					value={text}
					onChange={(value) => {
						setTaskValue('text', value);
					}}
				/>
				<TaskChips
					inputDomains={inputDomains}
					task={internalTask}
					setTaskValue={setTaskValue}
					newTag={newTag}
					setNewTag={setNewTag}
				/>
			</div>
			<TaskActions
				task={internalTask}
				onChangeState={() => {
					setTaskValue('state', state === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE');
				}}
				onDelete={onDelete}
			/>
		</div>
	);
};

export default Task;
