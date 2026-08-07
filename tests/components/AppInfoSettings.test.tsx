import { screen } from '@testing-library/react';
import { renderWithTranslations } from '../testUtils';
import { AppInfoSettings } from 'src/components/settings/AppInfoSettings';
import type { SpotAppInfoApi } from 'src/types/AppInfoTypes';

const originalAppInfoApi = window.spotAppInfo;

const setAppInfoApi = (value: unknown): void => {
	Object.defineProperty(window, 'spotAppInfo', {
		configurable: true,
		writable: true,
		value
	});
};

describe('AppInfoSettings', () => {
	afterEach(() => {
		setAppInfoApi(originalAppInfoApi);
		vi.restoreAllMocks();
	});

	// Two installed copies are told apart by this line and nothing else
	test('shows the version the main process reports', async() => {
		const appInfoApi: SpotAppInfoApi = {
			getAppInfo: vi.fn(async() => {
				return { version: '1.2.3' };
			})
		};
		setAppInfoApi(appInfoApi);

		renderWithTranslations(<AppInfoSettings/>);

		expect(await screen.findByText('SPOT version 1.2.3')).toBeInTheDocument();
		expect(appInfoApi.getAppInfo).toHaveBeenCalledTimes(1);
	});

	test('says the version is unknown rather than showing an empty line when it cannot be read', async() => {
		setAppInfoApi({
			getAppInfo: vi.fn(async() => {
				throw new Error('The app info channel is not registered');
			})
		});

		renderWithTranslations(<AppInfoSettings/>);

		expect(await screen.findByText('The SPOT version is unknown.')).toBeInTheDocument();
	});

	test('says the version is unknown when there is no Electron bridge at all', () => {
		setAppInfoApi(undefined);

		renderWithTranslations(<AppInfoSettings/>);

		expect(screen.getByText('The SPOT version is unknown.')).toBeInTheDocument();
	});
});
