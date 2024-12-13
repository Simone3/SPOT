import './Checkbox.css';
import { useState } from 'react';

const Checkbox = ({ label, checked }) => {
	const [ selected, setSelected ] = useState(checked);

	const input = (
		<input className='checkbox' type='checkbox' checked={selected} onChange={() => setSelected(!selected)}/>
	);

	if(label) {
		return (
			<label className='label'>
				{input}
				<span className='label-text'>{label}</span>
			</label>
		);
	}
	else {
		return input;
	}
};

export default Checkbox;
