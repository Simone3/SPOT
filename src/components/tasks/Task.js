import './Task.css';
import { useState } from 'react';
import { DateUtils } from '../../utils/DateUtils';
import Checkbox from '../inputs/Checkbox';
import Clickable from '../common/Clickable';
import Chip from '../common/Chip';
import EditIcon from '../icons/EditIcon';
import TagsIcon from '../icons/TagsIcon';
import CalendarIcon from '../icons/CalendarIcon';
import OwnerIcon from '../icons/OwnerIcon';

const Task = ({ task, onEdit }) => {
	const [ currentDates ] = useState(() => {
		const initialState = {};

		// Today
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		initialState.today = {
			date: today,
			label: 'Today'
		};
	
		// Yesterday
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		initialState.yesterday = {
			date: yesterday,
			label: 'Yesterday'
		};
	
		// Tomorrow
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		initialState.tomorrow = {
			date: tomorrow,
			label: 'Tomorrow'
		};
	
		// The 5 days after tomorrow with weekday labels
		initialState.fiveDaysAfterTomorrow = [];
		const loopDate = new Date(tomorrow);
		for(let i = 0; i < 5; i++) {
			loopDate.setDate(loopDate.getDate() + 1);
			initialState.fiveDaysAfterTomorrow.push({
				date: new Date(loopDate),
				label: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(loopDate)
			});
		}
	
		// Next working day (equal to tomorrow unless Sat or Sun)
		const nextWorkday = new Date(tomorrow);
		while(nextWorkday.getDay() === 0 || nextWorkday.getDay() === 6) {
			nextWorkday.setDate(nextWorkday.getDate() + 1);
		}
		initialState.nextWorkingDay = {
			date: nextWorkday,
			label: 'Next Workday'
		};
	
		return initialState;
	});

	const {
		text,
		state,
		priority,
		owner,
		dueDate,
		tags
	} = task;

	const [ completed, setCompleted ] = useState(state === 'COMPLETED');

	let containerClass = 'task-container';
	if(priority) {
		containerClass += ` task-container-${priority.toLowerCase()}`;
	}
	if(state) {
		containerClass += ` task-container-${state.toLowerCase()}`;
	}

	const chips = [];
	chips.push(<Chip key='owner' icon={<OwnerIcon/>} text={owner || 'Me'}/>);
	if(dueDate) {
		chips.push(<Chip key='due-date' icon={<CalendarIcon/>} text={DateUtils.toSmartString(dueDate, currentDates)} invalid={!completed && dueDate && DateUtils.compareDay(dueDate, new Date()) < 0}/>);
	}
	if(tags && tags.length > 0) {
		for(const tag of tags) {
			chips.push(<Chip key={`tag-${tag}`} icon={<TagsIcon/>} text={tag}/>);
		}
	}

	return (
		<div className={containerClass}>
			<div className='task-actions'>
				<Checkbox
					value={completed}
					onChange={setCompleted}/>
				<Clickable onClick={onEdit}>
					<EditIcon/>
				</Clickable>
			</div>
			<div className='task-content'>
				<div className='task-text'>
					{text}
				</div>
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
