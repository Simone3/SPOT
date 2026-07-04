import path from 'node:path';
import { REACT_BUILD_INDEX_RELATIVE_PATH, resolveWindowLoadTarget } from 'src/main/window/WindowLoadTarget';

describe('WindowLoadTarget', () => {
	test('uses the built React index file from the app root', () => {
		expect(resolveWindowLoadTarget({
			appRootDirectory: '/app/root'
		})).toEqual({
			type: 'file',
			value: path.join('/app/root', REACT_BUILD_INDEX_RELATIVE_PATH)
		});
	});
});
