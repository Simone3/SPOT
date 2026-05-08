import { useId, type ReactElement } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'src/components/inputs/DatePicker.css';

type DatePickerProps = {
	placeholder?: string;
	value?: string;
	onChange: (value: Date | null) => void;
	onBlur: () => void;
};

const DatePicker = ({ placeholder, value, onChange, onBlur }: DatePickerProps): ReactElement => {
	const id = useId();

	return (
		<div className='date-picker-container'>
			<ReactDatePicker
				id={id}
				selected={value ? new Date(value) : undefined}
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
