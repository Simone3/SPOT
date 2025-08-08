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
import DatePicker from '../inputs/DatePicker';
import WarningIcon from '../icons/WarningIcon';

/**
 * Returns a string value possibly changed to match an option capitalization
 * (value matches one of the options but not exacly the same case)
 */
const checkOptionCapitalization = (value, options) => {
	const compareValue = value.trim().toLowerCase();
	const caseInsensitiveMatch = options.find((option) => option.label.toLowerCase() === compareValue);
	if(caseInsensitiveMatch && caseInsensitiveMatch.label !== value) {
		return caseInsensitiveMatch.label;
	}
	else {
		return value;
	}
};

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

	const chips = [];

	// Owner chip
	chips.push(
		<Chip
			key='owner'
			leftIcon={<OwnerIcon/>}>
			<FreeSelectInput
				value={owner}
				placeholder={'Me'}
				onChange={(value) => {
					setTaskValue('owner', value);
				}}
				onFinishEditing={(value) => {
					// Update value for trimming/capitalization
					let changedValue = value ? value.trim() : value;
					changedValue = checkOptionCapitalization(changedValue, inputDomains.owners);
					if(changedValue !== value) {
						setTaskValue('owner', changedValue);
					}
				}}
				options={inputDomains.owners}
			/>
		</Chip>
	);

	// Due date chip
	chips.push(
		<Chip
			key='due-date'
			leftIcon={<CalendarIcon/>}
			rightIcon={dueDate && DateUtils.compareDay(new Date(dueDate), new Date()) <= 0 && <WarningIcon className='due-date-overdue-icon'/>}>
			<DatePicker
				value={dueDate}
				onChange={(value) => {
					setTaskValue('dueDate', DateUtils.toStandardYearMonthDay(value));
				}}
				placeholder={'No due date'}
			/>
		</Chip>
	);

	// Tag chips (if any)
	for(let i = 0; i < tags.length; i++) {
		chips.push(
			<Chip
				key={`tag-${i}`}
				leftIcon={<TagsIcon/>}>
				<FreeSelectInput
					value={tags[i]}
					placeholder={'Add tag...'}
					onChange={(value) => {
						setTaskValue('tags', (prevTags) => [ ...prevTags.slice(0, i), value, ...prevTags.slice(i + 1) ]);
					}}
					onFinishEditing={(value) => {
						let changedValue = value ? value.trim() : value;
						if(changedValue) {
							// Update value for trimming/capitalization
							changedValue = checkOptionCapitalization(changedValue, inputDomains.tags);
							if(changedValue !== value) {
								setTaskValue('tags', (prevTags) => [ ...prevTags.slice(0, i), changedValue, ...prevTags.slice(i + 1) ]);
							}
						}
						else {
							// Remove any empty tag from the array
							setTaskValue('tags', (prevTags) => [ ...prevTags.slice(0, i), ...prevTags.slice(i + 1) ]);
						}
					}}
					options={inputDomains.tags}
				/>
			</Chip>
		);
	}

	// New tag chip
	chips.push(
		<Chip
			key={`tag-new`}
			leftIcon={<TagsIcon/>}>
			<FreeSelectInput
				value={newTag}
				placeholder={'Add tag...'}
				onChange={(value) => {
					setNewTag(value);
				}}
				onFinishEditing={(value) => {
					let changedValue = value ? value.trim() : value;
					if(changedValue) {
						// Add as actual tag and reset new tag input
						changedValue = checkOptionCapitalization(changedValue, inputDomains.tags);
						setTaskValue('tags', (prevTags) => [ ...prevTags, changedValue ]);
						setNewTag('');
					}
					else if(changedValue !== value) {
						// Update for trimming
						setNewTag('');
					}
				}}
				options={inputDomains.tags}
			/>
		</Chip>
	);

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
						setTaskValue('state', state === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE');
					}}/>
				<Clickable onClick={onDelete}>
					<DeleteIcon/>
				</Clickable>
			</div>
			<div className='task-content'>
				<TextArea
					placeholder={'Add content...'}
					value={text}
					onChange={(value) => {
						setTaskValue('text', value);
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
