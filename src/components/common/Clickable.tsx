import './Clickable.css';
import type { MouseEventHandler, ReactNode } from 'react';

type ClickableProps = {
	children: ReactNode;
	onClick: MouseEventHandler<HTMLDivElement>;
};

const Clickable = ({ children, onClick }: ClickableProps) => {
	return (
		<div className='clickable' onClick={onClick}>
			{children}
		</div>
	);
};

export default Clickable;
