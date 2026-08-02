import type { ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { DatabaseLocationSettings } from 'src/components/storage/DatabaseLocationSettings';

const SettingsPage = (): ReactElement => {
	return (
		<Page>
			<Pane relativeSize={1}>
				<DatabaseLocationSettings/>
			</Pane>
		</Page>
	);
};

export { SettingsPage };
