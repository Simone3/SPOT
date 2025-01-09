import './Tooltipped.css';

const Tooltipped = ({ text, children }) => {
	return (
		<div className='tooltipped-container'>
			{children}
			<div className='tooltip-text-container'>
				<span className='tooltip-text'>{text}</span>
			</div>
		</div>
	);
};

export default Tooltipped;
