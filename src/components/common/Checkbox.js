import './Checkbox.css';

const Checkbox = ({ checked, onChange }) => {
	return (
		<input className='checkbox' type='checkbox' checked={checked} onChange={() => onChange(!checked)}/>
	);
};

export default Checkbox;
