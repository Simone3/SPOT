import './SidebarElement.css';
import { NavLink } from 'react-router';
import Tooltipped from './Tooltipped';

const SidebarElement = ({ title, to, icon }) => {
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
