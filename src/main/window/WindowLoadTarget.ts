import path from 'node:path';

export const REACT_DEVELOPMENT_SERVER_URL = 'http://localhost:3000';
export const REACT_BUILD_INDEX_RELATIVE_PATH = path.join('build', 'index.html');

export type WindowLoadTarget = {
	type: 'url';
	value: string;
} | {
	type: 'file';
	value: string;
};

export interface ResolveWindowLoadTargetOptions {
	isPackaged: boolean;
	appRootDirectory: string;
	developmentServerUrl?: string;
}

export const resolveWindowLoadTarget = ({
	isPackaged,
	appRootDirectory,
	developmentServerUrl = REACT_DEVELOPMENT_SERVER_URL
}: ResolveWindowLoadTargetOptions): WindowLoadTarget => {
	if(!isPackaged) {
		return {
			type: 'url',
			value: developmentServerUrl
		};
	}

	return {
		type: 'file',
		value: path.join(appRootDirectory, REACT_BUILD_INDEX_RELATIVE_PATH)
	};
};
