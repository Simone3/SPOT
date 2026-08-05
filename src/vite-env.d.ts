/// <reference types="vite/client" />

import type { SpotBackupLocationApi } from 'src/types/BackupLocationTypes';
import type { SpotStorageApi } from 'src/types/TaskStorageTypes';

declare global {
	interface Window {
		spotStorage: SpotStorageApi;
		spotBackupLocation: SpotBackupLocationApi;
		versions?: {
			node: () => string;
			chrome: () => string;
			electron: () => string;
			ping: () => Promise<string>;
		};
	}
}

export {};
