import { useId } from 'react';
import './TextInput.css';

type TextInputProps = {
	label?: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
};

const TextInput = ({ label, placeholder, value, onChange }: TextInputProps) => {
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
