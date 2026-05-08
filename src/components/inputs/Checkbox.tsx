import { useId } from 'react';
import './Checkbox.css';

type CheckboxProps = {
	label?: string;
	value: boolean;
	onChange: (value: boolean) => void;
	accentSelectedColor?: boolean;
};

const Checkbox = ({ label, value, onChange, accentSelectedColor }: CheckboxProps) => {
	const id = useId();

	return (
		<div className={`checkbox-container ${accentSelectedColor && 'checkbox-container-accent-selected'}`}>
			<input id={id} className='checkbox-input' type='checkbox' checked={value} onChange={() => {
				return onChange(!value);
			}}/>
			{label && <label htmlFor={id} className='checkbox-label'>{label}</label>}
		</div>
	);
};

export default Checkbox;
