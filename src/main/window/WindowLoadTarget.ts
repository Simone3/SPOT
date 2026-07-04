import path from 'node:path';

export const REACT_BUILD_INDEX_RELATIVE_PATH = path.join('build', 'index.html');

export type WindowLoadTarget = {
	type: 'file';
	value: string;
};

export interface ResolveWindowLoadTargetOptions {
	appRootDirectory: string;
}

export const resolveWindowLoadTarget = ({
	appRootDirectory
}: ResolveWindowLoadTargetOptions): WindowLoadTarget => {
	return {
		type: 'file',
		value: path.join(appRootDirectory, REACT_BUILD_INDEX_RELATIVE_PATH)
	};
};
