import './TextInput.css';
import { useState } from 'react';

const TextInput = ({ placeholder }) => {
	const [ value, setValue ] = useState('');

	return (
		<input className='text-input' type='text' placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)}/>
	);
};

export default TextInput;
