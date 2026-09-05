import { useId, type ReactElement } from 'react';
import 'src/components/inputs/NumberInput.css';

type NumberInputProps = {
	label?: string;
	value: string;
	minimum?: number;
	maximum?: number;
	disabled?: boolean;

	// The value is reported as it is typed, so that a half-typed number is not thrown away on every keystroke. What it means is the
	// caller's to decide, which is also what lets the caller decide when to act on it.
	onChange: (value: string) => void;

	// Called when the field is done being edited, either by leaving it or by pressing Enter
	onCommit: () => void;
};

const NumberInput = ({ label, value, minimum, maximum, disabled, onChange, onCommit }: NumberInputProps): ReactElement => {
	const id = useId();

	return (
		<div className='number-input-container'>
			{label && <label htmlFor={id} className='number-input-label'>{label}</label>}
			<input
				id={id}
				className='number-input'
				type='number'
				inputMode='numeric'
				step={1}
				min={minimum}
				max={maximum}
				value={value}
				disabled={disabled}
				onChange={(event) => {
					return onChange(event.target.value);
				}}
				onBlur={onCommit}
				onKeyDown={(event) => {
					if(event.key === 'Enter') {
						onCommit();
					}
				}}
			/>
		</div>
	);
};

export { NumberInput };
