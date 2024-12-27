import './TextArea.css';

const TextArea = ({ placeholder, value, onChange }) => {
	return (
		<textarea
			className='text-area'
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
};

export default TextArea;
