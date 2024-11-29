import './Sidebar.css';
import { NavLink } from 'react-router';
import NotesIcon from '../icons/NotesIcon';
import SettingsIcon from '../icons/SettingsIcon';
import TagsIcon from '../icons/TagsIcon';
import TasksIcon from '../icons/TasksIcon';

const Sidebar = () => {
	return (
		<div className='sidebar'>
			<div className='top'>
				<NavLink to='/'><TasksIcon/></NavLink>
				<NavLink to='/notes'><NotesIcon/></NavLink>
				<NavLink to='/tags'><TagsIcon/></NavLink>
			</div>
			<div className='bottom'>
				<NavLink to='/settings'><SettingsIcon/></NavLink>
			</div>
		</div>
	);
};

export default Sidebar;
