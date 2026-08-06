import 'src/components/common/Page.css';
import type { ReactElement, ReactNode } from 'react';

type PageProps = {
	children: ReactNode;
};

const Page = ({ children }: PageProps): ReactElement => {
	return (
		<div className='page'>
			{children}
		</div>
	);
};

export { Page };
