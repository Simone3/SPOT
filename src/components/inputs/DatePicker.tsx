import { useId, type ReactElement } from 'react';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'src/components/inputs/DatePicker.css';
import { DateUtils } from 'src/framework/utils/DateUtils';

type DatePickerProps = {
	placeholder?: string;
	value?: string;
	onChange: (value: Date | null) => void;
	onBlur: () => void;
	disabled?: boolean;
};

const DatePicker = ({ placeholder, value, onChange, onBlur, disabled }: DatePickerProps): ReactElement => {
	const id = useId();

	return (
		<div className='date-picker-container'>
			<ReactDatePicker
				id={id}
				selected={DateUtils.fromStandardYearMonthDay(value)}
				onChange={(date: Date | null) => {
					onChange(date);
				}}
				onBlur={onBlur}
				dateFormat='MMMM d, yyyy'
				placeholderText={placeholder}
				className='date-picker-input'
				calendarClassName='date-picker-calendar'
				calendarStartDay={1}
				disabled={disabled}
			/>
		</div>
	);
};

export { DatePicker };
