import 'src/components/common/Tooltipped.css';
import type { ReactElement, ReactNode } from 'react';

type TooltippedProps = {
	text: string;
	children: ReactNode;
};

const Tooltipped = ({ text, children }: TooltippedProps): ReactElement => {
	return (
		<div className='tooltipped-container'>
			{children}
			<div className='tooltip-text-container'>
				<span className='tooltip-text'>{text}</span>
			</div>
		</div>
	);
};

export { Tooltipped };
