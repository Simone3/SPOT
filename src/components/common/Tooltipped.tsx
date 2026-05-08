import 'src/components/common/Tooltipped.css';
import type { ReactNode } from 'react';

type TooltippedProps = {
	text: string;
	children: ReactNode;
};

const Tooltipped = ({ text, children }: TooltippedProps) => {
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
