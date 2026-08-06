import 'src/components/common/Sidebar.css';
import type { ReactElement } from 'react';
import { NotesIcon } from 'src/components/icons/NotesIcon';
import { SettingsIcon } from 'src/components/icons/SettingsIcon';
import { TagsIcon } from 'src/components/icons/TagsIcon';
import { TasksIcon } from 'src/components/icons/TasksIcon';
import { SidebarElement } from 'src/components/common/SidebarElement';
import { useTranslator } from 'src/i18n/TranslationContext';

const Sidebar = (): ReactElement => {
	const { t } = useTranslator();

	return (
		<div id='sidebar'>
			<div className='top'>
				<SidebarElement to='/' title={t('sidebar.tasks')} icon={<TasksIcon/>}/>
				<SidebarElement to='/notes' title={t('sidebar.notes')} icon={<NotesIcon/>}/>
				<SidebarElement to='/tags' title={t('sidebar.tags')} icon={<TagsIcon/>}/>
			</div>
			<div className='bottom'>
				<SidebarElement to='/settings' title={t('sidebar.settings')} icon={<SettingsIcon/>}/>
			</div>
		</div>
	);
};

export { Sidebar };
