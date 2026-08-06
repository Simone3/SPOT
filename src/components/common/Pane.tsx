import 'src/components/common/Pane.css';
import type { ReactElement, ReactNode } from 'react';

type PaneProps = {
	relativeSize: number;

	// A pane the user collapsed is still rendered, so it is taken out of the tab order and hidden from screen readers while it has no width
	inert?: boolean;
	children: ReactNode;
};

const Pane = ({ relativeSize, inert, children }: PaneProps): ReactElement => {
	return (
		<div className='pane' style={{ flex: relativeSize }} inert={inert}>
			{children}
		</div>
	);
};

export { Pane };
