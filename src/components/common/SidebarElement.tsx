import 'src/components/common/SidebarElement.css';
import { NavLink } from 'react-router';
import type { ReactNode } from 'react';
import Tooltipped from 'src/components/common/Tooltipped';

type SidebarElementProps = {
	title: string;
	to: string;
	icon: ReactNode;
};

const SidebarElement = ({ title, to, icon }: SidebarElementProps) => {
	return (
		<div className='sidebar-element-container'>
			<Tooltipped text={title}>
				<NavLink to={to}>
					{icon}
				</NavLink>
			</Tooltipped>
		</div>
	);
};

export default SidebarElement;
