import type { ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';

const NotesPage = (): ReactElement => {
	return (
		<Page>
			<Pane relativeSize={1}>
				Notes: work in progress
			</Pane>
		</Page>
	);
};

export { NotesPage };
