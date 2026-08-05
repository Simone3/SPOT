import 'src/components/tasks/TaskChips.css';
import type { ReactElement } from 'react';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { Chip } from 'src/components/common/Chip';
import { TagsIcon } from 'src/components/icons/TagsIcon';
import { CalendarIcon } from 'src/components/icons/CalendarIcon';
import { OwnerIcon } from 'src/components/icons/OwnerIcon';
import { FreeSelectInput } from 'src/components/inputs/FreeSelectInput';
import { DatePicker } from 'src/components/inputs/DatePicker';
import { WarningIcon } from 'src/components/icons/WarningIcon';
import type { FormDomains } from 'src/types/DomainTypes';
import type { Task as TaskType } from 'src/types/TaskTypes';

/**
 * Returns a string value possibly changed to match an option capitalization
 * (value matches one of the options but not exacly the same case)
 * @param value User-entered value to normalize.
 * @param options Available options to match against.
 * @returns The value with matching option capitalization.
 */
const checkOptionCapitalization = (value: string, options: { label: string }[]): string => {
	if(!value) {
		return value;
	}
	const compareValue = value.trim().toLowerCase();
	const caseInsensitiveMatch = options.find((option) => {
		return option.label.toLowerCase() === compareValue;
	});
	if(caseInsensitiveMatch && caseInsensitiveMatch.label !== value) {
		return caseInsensitiveMatch.label;
	}
	else {
		return value;
	}
};

type TaskChipsProps = {
	inputDomains: FormDomains;
	task: TaskType;
	setOwner: (owner: string, flush: boolean) => void;
	setDueDate: (dueDate: string, flush: boolean) => void;
	setTags: (changeTags: (prevTags: string[]) => string[], flush: boolean) => void;
	flushTaskChanges: () => void;
	newTag: string;
	setNewTag: (value: string) => void;
	disabled?: boolean;
};

const TaskChips = ({ inputDomains, task, setOwner, setDueDate, setTags, flushTaskChanges, newTag, setNewTag, disabled }: TaskChipsProps): ReactElement => {
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
				value={owner || ''}
				placeholder={'Me'}
				onChange={(value) => {
					setOwner(value, false);
				}}
				onFinishEditing={(value) => {
					let changedValue = value ? value.trim() : value;
					changedValue = checkOptionCapitalization(changedValue, inputDomains.owners);
					if(changedValue !== value) {
						// Update value for trimming/capitalization and then flush
						setOwner(changedValue, true);
					}
					else {
						// Otherwise just flush
						flushTaskChanges();
					}
				}}
				options={inputDomains.owners}
				disabled={disabled}
			/>
		</Chip>
	);

	// Due date chip
	const dueDateValue = DateUtils.fromStandardYearMonthDay(dueDate);
	const isOverdue = state !== 'COMPLETED' && dueDateValue && DateUtils.compareDay(dueDateValue, new Date()) <= 0;
	chips.push(
		<Chip
			key='due-date'
			leftIcon={<CalendarIcon/>}
			rightIcon={isOverdue && <WarningIcon className='due-date-overdue-icon'/>}>
			<DatePicker
				value={dueDate}
				onChange={(value) => {
					setDueDate(DateUtils.toStandardYearMonthDay(value), false);
				}}
				placeholder={'No due date'}
				onBlur={flushTaskChanges}
				disabled={disabled}
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
						setTags((prevTags) => {
							return [ ...prevTags.slice(0, i), value, ...prevTags.slice(i + 1) ];
						}, false);
					}}
					onFinishEditing={(value) => {
						const changedValue = value ? value.trim() : value;
						if(changedValue) {
							const normalizedValue = checkOptionCapitalization(changedValue, inputDomains.tags);
							if(normalizedValue !== value) {
								// Update value for trimming/capitalization and then flush
								setTags((prevTags) => {
									return [ ...prevTags.slice(0, i), normalizedValue, ...prevTags.slice(i + 1) ];
								}, true);
							}
							else {
								// Otherwise just flush
								flushTaskChanges();
							}
						}
						else {
							// Remove any empty tag from the array and then flush
							setTags((prevTags) => {
								return [ ...prevTags.slice(0, i), ...prevTags.slice(i + 1) ];
							}, true);
						}
					}}
					options={inputDomains.tags}
					disabled={disabled}
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
						const normalizedValue = checkOptionCapitalization(changedValue, inputDomains.tags);
						setNewTag('');
						setTags((prevTags) => {
							return [ ...prevTags, normalizedValue ];
						}, true);
					}
					else if(changedValue !== value) {
						// Update for trimming
						setNewTag('');
					}
				}}
				options={inputDomains.tags}
				disabled={disabled}
			/>
		</Chip>
	);

	return (
		<div className='task-chips'>
			{chips.map((chip) => {
				return chip;
			})}
		</div>
	);
};

export { TaskChips };
