import 'src/components/common/Pane.css';
import type { ReactElement, ReactNode, Ref } from 'react';

type PaneProps = {
	relativeSize: number;

	// A resizable pane is measured to decide how narrow it may get
	ref?: Ref<HTMLDivElement>;
	children: ReactNode;
};

const Pane = ({ relativeSize, ref, children }: PaneProps): ReactElement => {
	return (
		<div className='pane' style={{ flex: relativeSize }} ref={ref}>
			{children}
		</div>
	);
};

export { Pane };
