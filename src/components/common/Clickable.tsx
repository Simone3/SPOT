import 'src/components/common/Clickable.css';
import type { MouseEventHandler, ReactElement, ReactNode } from 'react';

type ClickableProps = {
	children: ReactNode;
	className?: string;
	onClick: MouseEventHandler<HTMLDivElement>;
};

const Clickable = ({ children, className, onClick }: ClickableProps): ReactElement => {
	return (
		<div className={`clickable ${className || ''}`} onClick={onClick}>
			{children}
		</div>
	);
};

export { Clickable };
