import 'src/components/inputs/Button.css';
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

type ButtonProps = {
	label: ReactNode;
	onClick: MouseEventHandler<HTMLButtonElement>;
	className?: string;
	style?: CSSProperties;
};

const Button = ({ label, onClick, className, style }: ButtonProps) => {
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
