import './TaskChips.css';
import { DateUtils } from '../../utils/DateUtils';
import Chip from '../common/Chip';
import TagsIcon from '../icons/TagsIcon';
import CalendarIcon from '../icons/CalendarIcon';
import OwnerIcon from '../icons/OwnerIcon';
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

const Task = ({ inputDomains, task, setTaskValue, newTag, setNewTag }) => {
	const {
		state,
		owner,
		dueDate,
		tags
	} = task;

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
	const isOverdue = state !== 'COMPLETED' && dueDate && DateUtils.compareDay(new Date(dueDate), new Date()) <= 0;
	chips.push(
		<Chip
			key='due-date'
			leftIcon={<CalendarIcon/>}
			rightIcon={isOverdue && <WarningIcon className='due-date-overdue-icon'/>}>
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

	return (
		<div className='task-chips'>
			{chips.map((chip) => chip)}
		</div>
	);
};

export default Task;
