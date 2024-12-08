import './Chip.css';

const Chip = ({ icon, text, invalid }) => {

	return (
		<div className={`chip ${invalid ? 'chip-invalid' : 'chip-valid'}`}>
			{icon}
			<div class='chip-text'>
				{text}
			</div>
		</div>
	);
};

export default Chip;
