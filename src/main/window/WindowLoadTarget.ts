import path from 'node:path';
import { WINDOW_CONFIG } from 'src/config/AppConfig';
import { resolveWindowLoadTarget as resolveFrameworkWindowLoadTarget, type WindowLoadTarget } from 'src/framework/main/window/WindowLoadTarget';

export const REACT_BUILD_INDEX_RELATIVE_PATH = path.join(...WINDOW_CONFIG.reactBuildIndexPathSegments);

export type { WindowLoadTarget } from 'src/framework/main/window/WindowLoadTarget';

export interface ResolveWindowLoadTargetOptions {
	appRootDirectory: string;
}

export const resolveWindowLoadTarget = ({
	appRootDirectory
}: ResolveWindowLoadTargetOptions): WindowLoadTarget => {
	return resolveFrameworkWindowLoadTarget({
		appRootDirectory,
		rendererIndexPathSegments: WINDOW_CONFIG.reactBuildIndexPathSegments
	});
};
