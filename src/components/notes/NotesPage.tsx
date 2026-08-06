import type { ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { useTranslator } from 'src/i18n/TranslationContext';

const NotesPage = (): ReactElement => {
	const { t } = useTranslator();

	return (
		<Page>
			<Pane relativeSize={1}>
				{t('pages.notesWorkInProgress')}
			</Pane>
		</Page>
	);
};

export { NotesPage };
