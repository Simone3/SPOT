import './TaskPriority.css';
import { useState, useId, useRef, type CSSProperties, type FocusEvent, type ReactNode } from 'react';
import PriorityLowIcon from '../icons/PriorityLowIcon';
import PriorityUrgentIcon from '../icons/PriorityUrgentIcon';
import PriorityHighIcon from '../icons/PriorityHighIcon';
import PriorityNormalIcon from '../icons/PriorityNormalIcon';
import type { DomainEntry } from '../../types/DomainTypes';
import type { TaskPriorityValue } from '../../types/TaskTypes';

type TaskPriorityProps = {
	priorityDomain: DomainEntry[];
	value: TaskPriorityValue;
	onChange: (value: TaskPriorityValue) => void;
	onBlur: () => void;
};

const TaskPriority = ({ priorityDomain, value, onChange, onBlur }: TaskPriorityProps) => {
	const id = useId();

	const [ open, setOpen ] = useState(false);

	const containerRef = useRef<HTMLDivElement>(null);

	const getPriorityIcon = (priority: TaskPriorityValue, addColorStyle: boolean): ReactNode => {
		const style: CSSProperties | undefined = addColorStyle ? { color: `var(--colors-priority-${priority.toLowerCase()})` } : undefined;
		switch(priority) {
			case 'URGENT':
				return <PriorityUrgentIcon style={style}/>;
			case 'HIGH':
				return <PriorityHighIcon style={style}/>;
			case 'NORMAL':
				return <PriorityNormalIcon style={style}/>;
			case 'LOW':
				return <PriorityLowIcon style={style}/>;
			default:
				throw Error(`Unmapped icon for ${priority} in priority picker`);
		}
	};

	const onCurrentValueClick = () => {
		setOpen(true);
	};

	const onNewValueClick = (newValue: TaskPriorityValue) => {
		if(value !== newValue) {
			onChange(newValue);
		}
		setOpen(false);
		onBlur();
	};

	const onOptionBlur = (e: FocusEvent<HTMLDivElement>) => {
		if(!containerRef.current!.contains(e.relatedTarget)) {
			setOpen(false);
			onBlur();
		}
	};

	return (
		<div className='task-priority'>
			<div className='task-priority-bar' style={{ background: `var(--colors-priority-${value.toLowerCase()})` }}></div>
			<div className='task-priority-picker' id={id} ref={containerRef}>
				{priorityDomain.map((domain) => {
					if(!open && domain.value !== value) {
						return undefined;
					}
					const priority = domain.value as TaskPriorityValue;
					return (
						<div
							key={domain.key}
							className='task-priority-picker-option'
							tabIndex={0}
							onBlur={onOptionBlur}
							onClick={open ? () => onNewValueClick(priority) : onCurrentValueClick}>
							{getPriorityIcon(priority, true || domain.value === value)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default TaskPriority;
