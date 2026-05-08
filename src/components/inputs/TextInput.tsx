import { useId, type ReactElement } from 'react';
import 'src/components/inputs/TextInput.css';

type TextInputProps = {
	label?: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
};

const TextInput = ({ label, placeholder, value, onChange }: TextInputProps): ReactElement => {
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
				onChange={(e) => {
					return onChange(e.target.value);
				}}
			/>
		</div>
	);
};

export { TextInput };
