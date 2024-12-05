import './Chip.css';

const Chip = ({ icon, text }) => {

	return (
		<div className='chip'>
			{icon}
			<div class='chip-text'>
				{text}
			</div>
		</div>
	);
};

export default Chip;
