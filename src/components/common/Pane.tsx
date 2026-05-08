import 'src/components/common/Pane.css';
import type { ReactNode } from 'react';

type PaneProps = {
	relativeSize: number;
	children: ReactNode;
};

const Pane = ({ relativeSize, children }: PaneProps) => {
	return (
		<div className='pane' style={{ flex: relativeSize }}>
			{children}
		</div>
	);
};

export default Pane;
