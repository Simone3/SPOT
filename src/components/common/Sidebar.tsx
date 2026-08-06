import 'src/components/common/Sidebar.css';
import type { ReactElement } from 'react';
import { SettingsIcon } from 'src/components/icons/SettingsIcon';
import { TasksIcon } from 'src/components/icons/TasksIcon';
import { SidebarElement } from 'src/components/common/SidebarElement';
import { useTranslator } from 'src/i18n/TranslationContext';

const Sidebar = (): ReactElement => {
	const { t } = useTranslator();

	return (
		<div id='sidebar'>
			<div className='top'>
				<SidebarElement to='/' title={t('sidebar.tasks')} icon={<TasksIcon/>}/>
			</div>
			<div className='bottom'>
				<SidebarElement to='/settings' title={t('sidebar.settings')} icon={<SettingsIcon/>}/>
			</div>
		</div>
	);
};

export { Sidebar };
