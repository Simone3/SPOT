import './DatePicker.css';

const DatePicker = ({ value, onChange }) => {

	return (
		<input
			className='date-picker'
			type='date'
			value={value}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
};

export default DatePicker;
