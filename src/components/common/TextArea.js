import './TextArea.css';
import { useState } from 'react';

const TextArea = ({ placeholder }) => {
	const [ value, setValue ] = useState('');

	return (
		<textarea
			className='text-area'
			placeholder={placeholder}
			value={value}
			onChange={(e) => setValue(e.target.value)}
		/>
	);
};

export default TextArea;
