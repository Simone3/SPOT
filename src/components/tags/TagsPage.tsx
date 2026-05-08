import type { ReactElement } from 'react';
import Page from 'src/components/common/Page';
import Pane from 'src/components/common/Pane';

const TagsPage = (): ReactElement => {
	return (
		<Page>
			<Pane relativeSize={1}>
				Tags: work in progress
			</Pane>
		</Page>
	);
};

export default TagsPage;
