import 'src/components/common/Pane.css';
import type { ReactElement, ReactNode } from 'react';

type PaneProps = {
	relativeSize: number;
	children: ReactNode;
};

const Pane = ({ relativeSize, children }: PaneProps): ReactElement => {
	return (
		<div className='pane' style={{ flex: relativeSize }}>
			{children}
		</div>
	);
};

export default Pane;
