import 'src/components/common/Header.css';
import type { ReactElement, ReactNode } from 'react';
import Clickable from 'src/components/common/Clickable';

export type HeaderAction = {
	id: string;
	icon: ReactNode;
	label: string;
	onClick: () => void;
};

type HeaderProps = {
	title: string;
	actions: HeaderAction[];
};

const Header = ({ title, actions }: HeaderProps): ReactElement => {
	return (
		<div className='header-line'>
			<h3 className='header-title'>{title}</h3>
			{actions.length > 0 &&
				<div className='header-actions'>
					{actions.map((action) => {
						return <Clickable onClick={action.onClick} key={action.id}>
							{action.icon}
							<div className='header-action-label'>{action.label}</div>
						</Clickable>;
					})
					}
				</div>
			}
		</div>
	);
};

export default Header;
