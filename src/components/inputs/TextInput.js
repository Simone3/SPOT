import './TextInput.css';

const TextInput = ({ placeholder, value, onChange }) => {
	return (
		<input
			className='text-input'
			type='text'
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
};

export default TextInput;
