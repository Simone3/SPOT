import { useId } from 'react';
import './TextInput.css';

const TextInput = ({ label, placeholder, value, onChange }) => {
	const id = useId();
	return (
		<div className='text-input-container'>
			{label && <label htmlFor={id} className='text-input-label'>{label}</label>}
			<input
				id={id}
				className='text-input'
				type='text'
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
};

export default TextInput;
