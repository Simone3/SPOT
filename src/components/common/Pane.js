import './Pane.css';

const Pane = ({ relativeSize, children }) => {
	return (
		<div className='pane' style={{ flex: relativeSize }}>
			{children}
		</div>
	);
};

export default Pane;
