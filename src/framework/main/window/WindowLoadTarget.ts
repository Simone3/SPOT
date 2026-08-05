import path from 'node:path';

export type WindowLoadTarget = {
	type: 'file';
	value: string;
};

export interface ResolveWindowLoadTargetOptions {
	appRootDirectory: string;

	// Where the built renderer entry file sits inside the application root, as path segments
	rendererIndexPathSegments: readonly string[];
}

export const resolveWindowLoadTarget = ({
	appRootDirectory,
	rendererIndexPathSegments
}: ResolveWindowLoadTargetOptions): WindowLoadTarget => {
	return {
		type: 'file',
		value: path.join(appRootDirectory, ...rendererIndexPathSegments)
	};
};
