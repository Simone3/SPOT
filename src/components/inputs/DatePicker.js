import { useId } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './DatePicker.css';

const DatePicker = ({ placeholder, value, onChange, onBlur }) => {
	const id = useId();

	return (
		<div className='date-picker-container'>
			<ReactDatePicker
				id={id}
				selected={value}
				onChange={(date) => {
					onChange(date);
				}}
				onBlur={onBlur}
				dateFormat='MMMM d, yyyy'
				placeholderText={placeholder}
				className='date-picker-input'
				calendarClassName='date-picker-calendar'
				calendarStartDay={1}
			/>
		</div>
	);
};

export default DatePicker;
