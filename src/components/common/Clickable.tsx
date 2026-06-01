import 'src/components/common/Clickable.css';
import type { MouseEventHandler, ReactElement, ReactNode } from 'react';

type ClickableProps = {
	children: ReactNode;
	className?: string;
	onClick: MouseEventHandler<HTMLDivElement>;
	disabled?: boolean;
};

const Clickable = ({ children, className, onClick, disabled }: ClickableProps): ReactElement => {
	let fullClassName = `clickable ${className || ''}`;
	if(disabled) {
		fullClassName += ' clickable-disabled';
	}

	return (
		<div
			className={fullClassName}
			aria-disabled={disabled}
			onClick={(event) => {
				if(!disabled) {
					onClick(event);
				}
			}}>
			{children}
		</div>
	);
};

export { Clickable };
