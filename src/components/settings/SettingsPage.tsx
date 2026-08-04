import type { ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { BackupSettings } from 'src/components/storage/BackupSettings';

const SettingsPage = (): ReactElement => {
	return (
		<Page>
			<Pane relativeSize={1}>
				<BackupSettings/>
			</Pane>
		</Page>
	);
};

export { SettingsPage };
