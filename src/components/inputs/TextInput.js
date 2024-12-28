import './TextInput.css';

const TextInput = ({ placeholder, value, setValue }) => {
	return (
		<input
			className='text-input'
			type='text'
			placeholder={placeholder}
			value={value}
			onChange={(e) => setValue(e.target.value)}
		/>
	);
};

export default TextInput;
