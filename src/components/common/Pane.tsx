import 'src/components/common/Pane.css';
import type { ReactElement, ReactNode, Ref } from 'react';

type PaneProps = {
	relativeSize: number;

	// A pane the user collapsed is still rendered, so it is taken out of the tab order and hidden from screen readers while it has no width
	inert?: boolean;

	// A resizable pane is measured to decide how narrow it may get
	ref?: Ref<HTMLDivElement>;
	children: ReactNode;
};

const Pane = ({ relativeSize, inert, ref, children }: PaneProps): ReactElement => {
	return (
		<div className='pane' style={{ flex: relativeSize }} inert={inert} ref={ref}>
			{children}
		</div>
	);
};

export { Pane };
