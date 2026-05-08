import 'src/components/common/MainContent.css';
import type { ReactNode } from 'react';

type MainContentProps = {
	children: ReactNode;
};

const MainContent = ({ children }: MainContentProps) => {
	return (
		<div id='main-content'>
			{children}
		</div>
	);
};

export default MainContent;
