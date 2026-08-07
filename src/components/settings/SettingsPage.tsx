import type { ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { AppInfoSettings } from 'src/components/settings/AppInfoSettings';
import { BackupSettings } from 'src/components/storage/BackupSettings';

const SettingsPage = (): ReactElement => {
	return (
		<Page>
			<Pane relativeSize={1}>
				<BackupSettings/>
				<AppInfoSettings/>
			</Pane>
		</Page>
	);
};

export { SettingsPage };
