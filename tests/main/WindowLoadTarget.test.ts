import path from 'node:path';
import { REACT_BUILD_INDEX_RELATIVE_PATH, REACT_DEVELOPMENT_SERVER_URL, resolveWindowLoadTarget } from 'src/main/window/WindowLoadTarget';

describe('WindowLoadTarget', () => {
	test('uses the React development server when Electron is not packaged', () => {
		expect(resolveWindowLoadTarget({
			isPackaged: false,
			appRootDirectory: '/app/root'
		})).toEqual({
			type: 'url',
			value: REACT_DEVELOPMENT_SERVER_URL
		});
	});

	test('allows a custom development server URL for local smoke checks', () => {
		expect(resolveWindowLoadTarget({
			isPackaged: false,
			appRootDirectory: '/app/root',
			developmentServerUrl: 'http://localhost:3001'
		})).toEqual({
			type: 'url',
			value: 'http://localhost:3001'
		});
	});

	test('uses the built React index file when Electron is packaged', () => {
		expect(resolveWindowLoadTarget({
			isPackaged: true,
			appRootDirectory: '/app/root'
		})).toEqual({
			type: 'file',
			value: path.join('/app/root', REACT_BUILD_INDEX_RELATIVE_PATH)
		});
	});
});
