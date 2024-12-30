import './Checkbox.css';

const Checkbox = ({ label, value, onChange }) => {
	const input = (
		<input className='checkbox' type='checkbox' checked={value} onChange={() => onChange(!value)}/>
	);

	if(label) {
		return (
			<label className='label'>
				{input}
				<span className='label-text'>{label}</span>
			</label>
		);
	}
	else {
		return input;
	}
};

export default Checkbox;
