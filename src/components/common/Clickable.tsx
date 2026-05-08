import 'src/components/common/Clickable.css';
import type { MouseEventHandler, ReactElement, ReactNode } from 'react';

type ClickableProps = {
	children: ReactNode;
	onClick: MouseEventHandler<HTMLDivElement>;
};

const Clickable = ({ children, onClick }: ClickableProps): ReactElement => {
	return (
		<div className='clickable' onClick={onClick}>
			{children}
		</div>
	);
};

export default Clickable;
