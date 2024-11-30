import './SidebarElement.css';
import { NavLink } from 'react-router';

const SidebarElement = ({ title, to, icon }) => {
	return (
		<div className='sidebar-element-container'>
			<NavLink to={to}>
				{icon}
			</NavLink>
			<span className='tooltip-text'>{title}</span>
		</div>
	);
};

export default SidebarElement;
