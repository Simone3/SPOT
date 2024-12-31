import { useId } from 'react';
import './Checkbox.css';

const Checkbox = ({ label, value, onChange }) => {
	const id = useId();

	return (
		<div className='checkbox-container'>
			<input id={id} className='checkbox-input' type='checkbox' checked={value} onChange={() => onChange(!value)}/>
			{label && <label htmlFor={id} className='checkbox-label'>{label}</label>}
		</div>
	);
};

export default Checkbox;
