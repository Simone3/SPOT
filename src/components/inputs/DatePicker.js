import { useId } from 'react';
import './DatePicker.css';

const DatePicker = ({ label, value, onChange }) => {
	const id = useId();

	return (
		<div className='date-picker-container'>
			{label && <label htmlFor={id} className='date-picker-label'>{label}</label>}
			<input
				id={id}
				className='date-picker-input'
				type='date'
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
};

export default DatePicker;
