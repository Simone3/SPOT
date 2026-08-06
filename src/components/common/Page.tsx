import 'src/components/common/Page.css';
import type { ReactElement, ReactNode, Ref } from 'react';

type PageProps = {
	children: ReactNode;

	// A split page measures itself to turn a dragged divider into pane widths
	ref?: Ref<HTMLDivElement>;
};

const Page = ({ children, ref }: PageProps): ReactElement => {
	return (
		<div className='page' ref={ref}>
			{children}
		</div>
	);
};

export { Page };
