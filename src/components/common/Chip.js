import './Chip.css';

const Chip = ({ leftIcon, rightIcon, children }) => {

	return (
		<div className='chip'>
			{leftIcon}
			<div className='chip-content'>
				{children}
			</div>
			{rightIcon}
		</div>
	);
};

export default Chip;
