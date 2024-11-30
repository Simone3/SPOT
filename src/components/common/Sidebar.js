import './Sidebar.css';
import NotesIcon from '../icons/NotesIcon';
import SettingsIcon from '../icons/SettingsIcon';
import TagsIcon from '../icons/TagsIcon';
import TasksIcon from '../icons/TasksIcon';
import SidebarElement from './SidebarElement';

const Sidebar = () => {
	return (
		<div className='sidebar'>
			<div className='top'>
				<SidebarElement to='/' title='Tasks' icon={<TasksIcon/>}/>
				<SidebarElement to='/notes' title='Notes' icon={<NotesIcon/>}/>
				<SidebarElement to='/tags' title='Tags' icon={<TagsIcon/>}/>
			</div>
			<div className='bottom'>
				<SidebarElement to='/settings' title='Settings' icon={<SettingsIcon/>}/>
			</div>
		</div>
	);
};

export default Sidebar;
