import 'src/components/common/Clickable.css';
import type { MouseEventHandler, ReactElement, ReactNode } from 'react';

type ClickableProps = {
	children: ReactNode;
	className?: string;
	label?: string;
	onClick: MouseEventHandler<HTMLButtonElement>;
	disabled?: boolean;
};

/**
 * Anything the caller renders, made clickable. It is a button and not a clickable div, because the keyboard has to
 * reach it, activate it and show the focus ring on it the way it does for every other control in the application.
 * @param props Clickable content, label and callbacks.
 * @returns The clickable control.
 */
const Clickable = (props: ClickableProps): ReactElement => {
	const { children, className, label, onClick, disabled } = props;

	return (
		<button
			type='button'
			className={`clickable ${className || ''}`}
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}>
			{children}
		</button>
	);
};

export { Clickable };
