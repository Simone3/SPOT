import './Task.css';
import { useContext } from 'react';
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

const Task = ({ task, onSave, onDelete }) => {
	const currentDates = useContext(DatesContext);

	const {
		text,
		state,
		priority,
		owner,
		dueDate,
		tags
	} = task;

	const parsedDueDate = dueDate ? new Date(dueDate) : undefined;

	let containerClass = 'task-container';
	if(priority) {
		containerClass += ` task-container-${priority.toLowerCase()}`;
	}
	if(state) {
		containerClass += ` task-container-${state.toLowerCase()}`;
	}

	const chips = [];
	chips.push(
		<Chip
			key='owner'
			icon={<OwnerIcon/>}
			text={owner || 'Me'}
		/>
	);
	if(parsedDueDate) {
		chips.push(
			<Chip
				key='due-date'
				icon={<CalendarIcon/>}
				text={DateUtils.toSmartString(parsedDueDate, currentDates)}
				invalid={task.state === 'ACTIVE' && DateUtils.compareDay(parsedDueDate, new Date()) < 0}
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

	return (
		<div className={containerClass}>
			<div className='task-actions'>
				<Checkbox
					value={task.state === 'COMPLETED'}
					onChange={() => {
						onSave({
							state: task.state === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE'
						});
					}}/>
				<Clickable onClick={onDelete}>
					<DeleteIcon/>
				</Clickable>
			</div>
			<div className='task-content'>
				<TextArea
					placeholder={'<no content>'}
					value={text}
					onChange={(value) => onSave({ text: value })}
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
