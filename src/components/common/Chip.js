import './Chip.css';

const Chip = ({ icon, invalid, children }) => {

	return (
		<div className={`chip ${invalid ? 'chip-invalid' : 'chip-valid'}`}>
			{icon}
			<div className='chip-content'>
				{children}
			</div>
		</div>
	);
};

export default Chip;
