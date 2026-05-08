import type { ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';

const SettingsPage = (): ReactElement => {
	return (
		<Page>
			<Pane relativeSize={1}>
				Settings: work in progress
			</Pane>
		</Page>
	);
};

export { SettingsPage };
