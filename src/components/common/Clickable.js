import './Clickable.css';

const Clickable = ({ children, onClick }) => {
	return (
		<div className='clickable' onClick={onClick}>
			{children}
		</div>
	);
};

export default Clickable;
