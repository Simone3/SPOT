import 'src/components/tasks/TaskChips.css';
import { useId, type ReactElement } from 'react';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { Chip } from 'src/components/common/Chip';
import { TagsIcon } from 'src/components/icons/TagsIcon';
import { CalendarIcon } from 'src/components/icons/CalendarIcon';
import { OwnerIcon } from 'src/components/icons/OwnerIcon';
import { FreeSelectInput } from 'src/components/inputs/FreeSelectInput';
import { DatePicker } from 'src/components/inputs/DatePicker';
import { WarningIcon } from 'src/components/icons/WarningIcon';
import type { TaskChangeFlushMode } from 'src/logic/PendingTaskChanges';
import type { FormDomains } from 'src/types/DomainTypes';
import type { Task as TaskType } from 'src/types/TaskTypes';
import { useTranslator } from 'src/i18n/TranslationContext';

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
	setOwner: (owner: string, flushMode: TaskChangeFlushMode) => void;
	setDueDate: (dueDate: string, flushMode: TaskChangeFlushMode) => void;
	setTags: (changeTags: (prevTags: string[]) => string[], flushMode: TaskChangeFlushMode) => void;
	flushTaskChanges: () => void;
	disabled?: boolean;
};

/**
 * Returns the tags to show, which are the task tags plus the trailing empty tag the user types the next tag into.
 * The trailing tag is only a rendered input: it becomes a task tag as soon as the user types into it, and it never reaches the database.
 * @param tags Task tags.
 * @returns The task tags, always followed by exactly one empty tag.
 */
const getTagsWithTrailingInput = (tags: string[]): string[] => {
	return tags.length === 0 || tags[tags.length - 1] ? [ ...tags, '' ] : tags;
};

const TaskChips = ({ inputDomains, task, setOwner, setDueDate, setTags, flushTaskChanges, disabled }: TaskChipsProps): ReactElement => {
	const { t } = useTranslator();
	const {
		state,
		owner,
		dueDate,
		tags
	} = task;

	// Each chip gives its input an id of its own, so that the chip icon can label the input and clicking the icon focuses it
	const inputIdPrefix = useId();

	const chips = [];

	// Owner chip
	const ownerInputId = `${inputIdPrefix}owner`;
	chips.push(
		<Chip
			key='owner'
			inputId={ownerInputId}
			leftIcon={<OwnerIcon/>}>
			<FreeSelectInput
				id={ownerInputId}
				value={owner || ''}
				placeholder={t('tasks.fields.ownerPlaceholder')}
				onChange={(value) => {
					setOwner(value, 'delayed');
				}}
				onFinishEditing={(value) => {
					let changedValue = value ? value.trim() : value;
					changedValue = checkOptionCapitalization(changedValue, inputDomains.owners);
					if(changedValue !== value) {
						// Update value for trimming/capitalization and then flush
						setOwner(changedValue, 'immediate');
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
	const dueDateInputId = `${inputIdPrefix}due-date`;
	chips.push(
		<Chip
			key='due-date'
			inputId={dueDateInputId}
			leftIcon={<CalendarIcon/>}
			rightIcon={isOverdue && <WarningIcon className='due-date-overdue-icon'/>}>
			<DatePicker
				id={dueDateInputId}
				value={dueDate}
				onChange={(value) => {
					setDueDate(DateUtils.toStandardYearMonthDay(value), 'delayed');
				}}
				placeholder={t('tasks.fields.dueDatePlaceholder')}
				onBlur={flushTaskChanges}
				disabled={disabled}
			/>
		</Chip>
	);

	// Tag chips, the last of which is always the empty input for the next tag
	const tagsWithTrailingInput = getTagsWithTrailingInput(tags);
	for(let i = 0; i < tagsWithTrailingInput.length; i++) {
		const tagInputId = `${inputIdPrefix}tag-${i}`;
		chips.push(
			<Chip
				key={`tag-${i}`}
				inputId={tagInputId}
				leftIcon={<TagsIcon/>}>
				<FreeSelectInput
					id={tagInputId}
					value={tagsWithTrailingInput[i]}
					placeholder={t('tasks.fields.tagPlaceholder')}
					onChange={(value) => {
						// A tag the user is still typing is buffered but not saved on its own, so half-typed tags never reach the database
						setTags((prevTags) => {
							return [ ...prevTags.slice(0, i), value, ...prevTags.slice(i + 1) ];
						}, 'buffered');
					}}
					onFinishEditing={(value) => {
						const changedValue = value ? value.trim() : value;
						if(changedValue) {
							const normalizedValue = checkOptionCapitalization(changedValue, inputDomains.tags);
							if(normalizedValue !== value) {
								// Update value for trimming/capitalization and then flush
								setTags((prevTags) => {
									return [ ...prevTags.slice(0, i), normalizedValue, ...prevTags.slice(i + 1) ];
								}, 'immediate');
							}
							else {
								// Otherwise just flush
								flushTaskChanges();
							}
						}
						else if(i < tags.length) {
							// Remove any empty tag from the array and then flush. A trailing input the user never typed into is not in the
							// array at all, so there is nothing to remove and the next render puts it back anyway.
							setTags((prevTags) => {
								return [ ...prevTags.slice(0, i), ...prevTags.slice(i + 1) ];
							}, 'immediate');
						}
					}}
					options={inputDomains.tags}
					disabled={disabled}
				/>
			</Chip>
		);
	}

	return (
		<div className='task-chips'>
			{chips.map((chip) => {
				return chip;
			})}
		</div>
	);
};

export { TaskChips };
