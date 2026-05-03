import './TaskChips.css';
import { DateUtils } from '../../utils/DateUtils';
import Chip from '../common/Chip';
import TagsIcon from '../icons/TagsIcon';
import CalendarIcon from '../icons/CalendarIcon';
import OwnerIcon from '../icons/OwnerIcon';
import FreeSelectInput from '../inputs/FreeSelectInput';
import DatePicker from '../inputs/DatePicker';
import WarningIcon from '../icons/WarningIcon';
import type { FormDomains, Task as TaskType } from '../../types';

/**
 * Returns a string value possibly changed to match an option capitalization
 * (value matches one of the options but not exacly the same case)
 */
const checkOptionCapitalization = (value: string | undefined, options: { label: string }[]) => {
	if(!value) {
		return value;
	}
	const compareValue = value.trim().toLowerCase();
	const caseInsensitiveMatch = options.find((option) => option.label.toLowerCase() === compareValue);
	if(caseInsensitiveMatch && caseInsensitiveMatch.label !== value) {
		return caseInsensitiveMatch.label;
	}
	else {
		return value;
	}
};

type SetTaskValue = <TKey extends keyof TaskType>(key: TKey, valueOrCallback: TaskType[TKey] | ((prevValue: TaskType[TKey]) => TaskType[TKey]), flush: boolean) => void;

type TaskChipsProps = {
	inputDomains: FormDomains;
	task: TaskType;
	setTaskValue: SetTaskValue;
	flushTaskChanges: () => void;
	newTag: string;
	setNewTag: (value: string) => void;
};

const TaskChips = ({ inputDomains, task, setTaskValue, flushTaskChanges, newTag, setNewTag }: TaskChipsProps) => {
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
					setTaskValue('owner', value, false);
				}}
				onFinishEditing={(value) => {
					let changedValue = value ? value.trim() : value;
					changedValue = checkOptionCapitalization(changedValue, inputDomains.owners);
					if(changedValue !== value) {
						// Update value for trimming/capitalization and then flush
						setTaskValue('owner', changedValue, true);
					}
					else {
						// Otherwise just flush
						flushTaskChanges();
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
					setTaskValue('dueDate', DateUtils.toStandardYearMonthDay(value), false);
				}}
				placeholder={'No due date'}
				onBlur={flushTaskChanges}
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
						setTaskValue('tags', (prevTags) => [ ...prevTags.slice(0, i), value, ...prevTags.slice(i + 1) ], false);
					}}
					onFinishEditing={(value) => {
						const changedValue = value ? value.trim() : value;
						if(changedValue) {
							const normalizedValue = checkOptionCapitalization(changedValue, inputDomains.tags) as string;
							if(normalizedValue !== value) {
								// Update value for trimming/capitalization and then flush
								setTaskValue('tags', (prevTags) => [ ...prevTags.slice(0, i), normalizedValue, ...prevTags.slice(i + 1) ], true);
							}
							else {
								// Otherwise just flush
								flushTaskChanges();
							}
						}
						else {
							// Remove any empty tag from the array and then flush
							setTaskValue('tags', (prevTags) => [ ...prevTags.slice(0, i), ...prevTags.slice(i + 1) ], true);
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
					const changedValue = value ? value.trim() : value;
					if(changedValue) {
						// Reset new tag input, add as actual tag and then flush
						const normalizedValue = checkOptionCapitalization(changedValue, inputDomains.tags) as string;
						setNewTag('');
						setTaskValue('tags', (prevTags) => [ ...prevTags, normalizedValue ], true);
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

export default TaskChips;
