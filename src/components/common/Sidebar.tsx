import 'src/components/common/Sidebar.css';
import type { ReactElement } from 'react';
import NotesIcon from 'src/components/icons/NotesIcon';
import SettingsIcon from 'src/components/icons/SettingsIcon';
import TagsIcon from 'src/components/icons/TagsIcon';
import TasksIcon from 'src/components/icons/TasksIcon';
import SidebarElement from 'src/components/common/SidebarElement';

const Sidebar = (): ReactElement => {
	return (
		<div id='sidebar'>
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
