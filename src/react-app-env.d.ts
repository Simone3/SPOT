/// <reference types="react-scripts" />

import type { SpotStorageApi } from 'src/types/TaskStorageTypes';

declare global {
	interface Window {
		spotStorage: SpotStorageApi;
		versions?: {
			node: () => string;
			chrome: () => string;
			electron: () => string;
			ping: () => Promise<string>;
		};
	}
}

export {};
