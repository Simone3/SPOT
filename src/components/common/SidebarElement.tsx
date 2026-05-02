import './SidebarElement.css';
import { NavLink } from 'react-router';
import Tooltipped from './Tooltipped';
import type { ReactNode } from 'react';

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
