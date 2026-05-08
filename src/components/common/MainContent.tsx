import 'src/components/common/MainContent.css';
import type { ReactElement, ReactNode } from 'react';

type MainContentProps = {
	children: ReactNode;
};

const MainContent = ({ children }: MainContentProps): ReactElement => {
	return (
		<div id='main-content'>
			{children}
		</div>
	);
};

export { MainContent };
