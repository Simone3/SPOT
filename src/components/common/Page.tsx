import 'src/components/common/Page.css';
import type { ReactNode } from 'react';

type PageProps = {
	children: ReactNode;
};

const Page = ({ children }: PageProps) => {
	return (
		<div className='page'>
			{children}
		</div>
	);
};

export default Page;
