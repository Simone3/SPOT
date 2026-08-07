// What SPOT can say about the build it is running as. The main process is the only side that knows it, so the renderer asks for it.
export interface SpotAppInfo {

	// The version Electron reports for the running application, which is the "version" field of "package.json"
	version: string;
}

export interface SpotAppInfoApi {
	getAppInfo: () => Promise<SpotAppInfo>;
}
