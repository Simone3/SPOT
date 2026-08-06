import path from 'node:path';
import { WINDOW_CONFIG } from 'src/config/AppConfig';
import { resolveWindowLoadTarget as resolveFrameworkWindowLoadTarget, type WindowLoadTarget } from 'src/framework/main/window/WindowLoadTarget';

export const REACT_BUILD_INDEX_RELATIVE_PATH = path.join(...WINDOW_CONFIG.reactBuildIndexPathSegments);

export type { WindowLoadTarget } from 'src/framework/main/window/WindowLoadTarget';

export interface ResolveWindowLoadTargetOptions {
	appRootDirectory: string;

	// A packaged SPOT always loads the renderer from disk. Honouring the development server variable there would let anything that can set
	// an environment variable put a page of its own choosing behind the preload bridge.
	isPackaged: boolean;
}

export const resolveWindowLoadTarget = ({
	appRootDirectory,
	isPackaged
}: ResolveWindowLoadTargetOptions): WindowLoadTarget => {
	return resolveFrameworkWindowLoadTarget({
		appRootDirectory,
		rendererIndexPathSegments: WINDOW_CONFIG.reactBuildIndexPathSegments,

		// The development server is not known until "npm start" starts it, so the port it picked is passed to this process in its environment
		// eslint-disable-next-line no-process-env
		developmentServerUrl: isPackaged ? undefined : process.env[WINDOW_CONFIG.developmentServerUrlVariable]
	});
};
