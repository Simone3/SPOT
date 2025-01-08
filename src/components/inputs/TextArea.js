import { useId, useState } from 'react';
import './TextArea.css';

const TextArea = ({ label, placeholder, value, onChange, validate, forceShowInvalid }) => {
	const id = useId();

	const [ touched, setTouched ] = useState(false);

	const showInvalid = validate && (touched || forceShowInvalid) && !validate(value);

	return (
		<div className={`textarea-container ${showInvalid && 'textarea-container-invalid'}`}>
			{label && <label htmlFor={id} className='textarea-label'>{label}</label>}
			<textarea
				id={id}
				className='textarea-input'
				placeholder={placeholder}
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
				}}
				onBlur={() => {
					if(!touched) {
						setTouched(true);
					}
				}}
			/>
		</div>
	);
};

export default TextArea;
