import { useId } from 'react';
import './TextArea.css';

const TextArea = ({ label, placeholder, value, onChange }) => {
	const id = useId();
	return (
		<div className='textarea-container'>
			{label && <label htmlFor={id} className='textarea-label'>{label}</label>}
			<textarea
				id={id}
				className='textarea-input'
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
};

export default TextArea;
