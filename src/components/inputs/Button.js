import './Button.css';

const Button = ({ label, onClick, className, style }) => {
	
	return (
		<button
			onClick={onClick}
			className={`button ${className}`}
			style={style}>
			{label}
		</button>
	);
};

export default Button;
