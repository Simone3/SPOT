import './Sidebar.css';
import { NavLink } from 'react-router';

const Sidebar = () => {
	return (
		<div className='sidebar'>
			<NavLink to='/'>Tasks</NavLink>
			<NavLink to='/notes'>Notes</NavLink>
		</div>
	);
};

export default Sidebar;
