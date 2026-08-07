import 'src/components/settings/AppInfoSettings.css';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SpotAppInfoApi } from 'src/types/AppInfoTypes';

// The main process is the only side that knows which build this is, so the version is asked for once when the section mounts
const useAppVersion = (): string | undefined => {
	const [ version, setVersion ] = useState<string | undefined>();

	useEffect(() => {
		const appInfoApi = window.spotAppInfo as SpotAppInfoApi | undefined;

		if(!appInfoApi) {
			return undefined;
		}

		let didCancelLoad = false;

		void appInfoApi.getAppInfo().then((appInfo) => {
			if(!didCancelLoad) {
				setVersion(appInfo.version);
			}
		}, () => {
			// Nothing to report: a version that cannot be read is a line the section leaves out, not a failure worth a warning
			return undefined;
		});

		return () => {
			didCancelLoad = true;
		};
	}, []);

	return version;
};

const AppInfoSettings = (): ReactElement => {
	const { t } = useTranslator();
	const version = useAppVersion();

	return (
		<div className='app-info-settings'>
			<h3 className='app-info-settings-title'>{t('appInfo.title')}</h3>
			<p className='app-info-settings-version'>
				{version ? t('appInfo.version', { version }) : t('appInfo.unknownVersion')}
			</p>
		</div>
	);
};

export { AppInfoSettings };
