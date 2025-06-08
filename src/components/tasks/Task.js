import './Task.css';
import { useContext, useState, useRef, useEffect } from 'react';
import { DateUtils } from '../../utils/DateUtils';
import Checkbox from '../inputs/Checkbox';
import Clickable from '../common/Clickable';
import Chip from '../common/Chip';
import DeleteIcon from '../icons/DeleteIcon';
import TagsIcon from '../icons/TagsIcon';
import CalendarIcon from '../icons/CalendarIcon';
import OwnerIcon from '../icons/OwnerIcon';
import { DatesContext } from '../../contexts/DatesContexr';
import TextArea from '../inputs/TextArea';
import FreeSelectInput from '../inputs/FreeSelectInput';

const Task = ({ task: taskFromProps, inputDomains, onSave: onSaveFromProps, onDelete }) => {
	const currentDates = useContext(DatesContext);

	// Internal copy of the task, for delayed changes propagation to main state
	const [ internalTask, setInternalTask ] = useState(taskFromProps);
	const {
		text,
		state,
		priority,
		owner,
		dueDate,
		tags
	} = internalTask;

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

	// Helper to update both state and ref when values change, and (re)set the save timeout
	const setValue = (key, value) => {
		setInternalTask({ ...internalTask, [key]: value });
		changedValuesRef.current[key] = value;
		resetTimeout(saveTaskIfNecessary);
	};
	
	// On component unmount, flush any pending changes
	useEffect(() => {
		return () => {
			clearTimeoutIfAny();
			saveTaskIfNecessary();
		};
	}, []);

	// Dynamic list of "chips"
	const chips = [];
	chips.push(
		<Chip
			key='owner'
			icon={<OwnerIcon/>}>
				<FreeSelectInput
					value={owner}
					placeholder={'Me'}
					onChange={(value) => {
						setValue('owner', value);
					}}
					options={inputDomains.owners}
				/>
		</Chip>
	);
	if(dueDate) {
		const parsedDueDate = new Date(dueDate);
		chips.push(
			<Chip
				key='due-date'
				icon={<CalendarIcon/>}
				text={DateUtils.toSmartString(parsedDueDate, currentDates)}
				invalid={state === 'ACTIVE' && DateUtils.compareDay(parsedDueDate, new Date()) < 0}
			/>
		);
	}
	if(tags && tags.length > 0) {
		for(const tag of tags) {
			chips.push(
				<Chip
					key={`tag-${tag}`}
					icon={<TagsIcon/>}
					text={tag}
				/>
			);
		}
	}

	// Dynamic container class
	let containerClass = 'task-container';
	if(priority) {
		containerClass += ` task-container-${priority.toLowerCase()}`;
	}
	if(state) {
		containerClass += ` task-container-${state.toLowerCase()}`;
	}

	return (
		<div className={containerClass}>
			<div className='task-actions'>
				<Checkbox
					value={state === 'COMPLETED'}
					onChange={() => {
						setValue('state', state === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE');
					}}/>
				<Clickable onClick={onDelete}>
					<DeleteIcon/>
				</Clickable>
			</div>
			<div className='task-content'>
				<TextArea
					placeholder={'<no content>'}
					value={text}
					onChange={(value) => {
						setValue('text', value);
					}}
				/>
				{(chips.length > 0) &&
					<div className='task-chips'>
						{chips.map((chip) => chip)}
					</div>
				}
			</div>
		</div>
	);
};

export default Task;
