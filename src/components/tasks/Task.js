import { DateUtils } from '../../utils/DateUtils';
import Checkbox from '../common/Checkbox';
import EditIcon from '../icons/EditIcon';
import './Task.css';

// TODO move this to state and update it every day (setTimeout at midnight plus 1 second or something)
const buildCurrentDates = () => {
	const currentDates = {};

	// Today
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	currentDates.today = {
		date: today,
		label: 'Today'
	};

	// Yesterday
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	currentDates.yesterday = {
		date: yesterday,
		label: 'Yesterday'
	};

	// Tomorrow
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	currentDates.tomorrow = {
		date: tomorrow,
		label: 'Tomorrow'
	};

	// The 5 days after tomorrow with weekday labels
	currentDates.fiveDaysAfterTomorrow = [];
	const loopDate = new Date(tomorrow);
	for(let i = 0; i < 5; i++) {
		loopDate.setDate(loopDate.getDate() + 1);
		currentDates.fiveDaysAfterTomorrow.push({
			date: new Date(loopDate),
			label: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(loopDate)
		});
	}

	// Next working day (equal to tomorrow unless Sat or Sun)
	const nextWorkday = new Date(tomorrow);
	while(nextWorkday.getDay() === 0 || nextWorkday.getDay() === 6) {
		nextWorkday.setDate(nextWorkday.getDate() + 1);
	}
	currentDates.nextWorkingDay = {
		date: nextWorkday,
		label: 'Next Workday'
	};

	return currentDates;
};

const currentDates = buildCurrentDates();

const Task = ({ task }) => {

	const {
		text,
		state,
		priority,
		owner,
		dueDate,
		tags
	} = task;

	const completed = state === 'COMPLETED';

	let containerClass = 'task-container';
	if(priority) {
		containerClass += ` task-container-${priority.toLowerCase()}`;
	}
	if(state) {
		containerClass += ` task-container-${state.toLowerCase()}`;
	}
	if(!completed && dueDate && dueDate.getTime() < Date.now()) {
		containerClass += ` task-container-overdue`;
	}

	return (
		<div className={containerClass}>
			<div className='task-actions'>
				<Checkbox checked={completed}/>
				<EditIcon/>
			</div>
			<div className='task-content'>
				<span className='task-text'>{text}</span>
				{owner && <span className='task-owner'>Owner: {owner}</span>}
				{dueDate && <span className='task-due-date'>Due: {DateUtils.toSmartString(dueDate, currentDates)}</span>}
			</div>
			<div className='task-tags'>
				{tags ? tags.join(', ') : ''}
			</div>
		</div>
	);
};

export default Task;
