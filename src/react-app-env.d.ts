/// <reference types="react-scripts" />

import type { SpotDatabaseLocationApi } from 'src/types/DatabaseLocationTypes';
import type { SpotStorageApi } from 'src/types/TaskStorageTypes';

declare global {
	interface Window {
		spotStorage: SpotStorageApi;
		spotDatabaseLocation: SpotDatabaseLocationApi;
		versions?: {
			node: () => string;
			chrome: () => string;
			electron: () => string;
			ping: () => Promise<string>;
		};
	}
}

export {};
