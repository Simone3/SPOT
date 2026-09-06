import 'src/components/inputs/Button.css';
import type { CSSProperties, MouseEventHandler, ReactElement, ReactNode } from 'react';

type ButtonProps = {
	label: ReactNode;
	onClick: MouseEventHandler<HTMLButtonElement>;
	className?: string;
	style?: CSSProperties;

	// What the button is called when reading its content out would not name it, the way a label followed by a bare count does not
	ariaLabel?: string;
};

const Button = ({ label, onClick, className, style, ariaLabel }: ButtonProps): ReactElement => {
	return (
		<button
			onClick={onClick}
			className={`button ${className}`}
			style={style}
			aria-label={ariaLabel}>
			{label}
		</button>
	);
};

export { Button };
