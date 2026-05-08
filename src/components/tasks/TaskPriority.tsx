import 'src/components/tasks/TaskPriority.css';
import { useState, useId, useRef, type CSSProperties, type FocusEvent, type ReactElement, type ReactNode } from 'react';
import { PriorityLowIcon } from 'src/components/icons/PriorityLowIcon';
import { PriorityUrgentIcon } from 'src/components/icons/PriorityUrgentIcon';
import { PriorityHighIcon } from 'src/components/icons/PriorityHighIcon';
import { PriorityNormalIcon } from 'src/components/icons/PriorityNormalIcon';
import type { DomainEntry } from 'src/types/DomainTypes';
import type { TaskPriorityValue } from 'src/types/TaskTypes';

type TaskPriorityProps = {
	priorityDomain: DomainEntry[];
	value: TaskPriorityValue;
	onChange: (value: TaskPriorityValue) => void;
	onBlur: () => void;
};

const TaskPriority = ({ priorityDomain, value, onChange, onBlur }: TaskPriorityProps): ReactElement => {
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
				throw Error('Unmapped icon in priority picker');
		}
	};

	const onCurrentValueClick = (): void => {
		setOpen(true);
	};

	const onNewValueClick = (newValue: TaskPriorityValue): void => {
		if(value !== newValue) {
			onChange(newValue);
		}
		setOpen(false);
		onBlur();
	};

	const onOptionBlur = (e: FocusEvent<HTMLDivElement>): void => {
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
							onClick={open ?
								() => {
									return onNewValueClick(priority);
								} :
								onCurrentValueClick}>
							{getPriorityIcon(priority, true)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export { TaskPriority };
