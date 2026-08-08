/// <reference types="vite/client" />

import type { SpotAppInfoApi } from 'src/types/AppInfoTypes';
import type { SpotAppMenuApi } from 'src/types/AppMenuTypes';
import type { SpotBackupLocationApi } from 'src/types/BackupLocationTypes';
import type { SpotDiagnosticsApi } from 'src/types/DiagnosticsTypes';
import type { SpotStorageApi } from 'src/types/TaskStorageTypes';

declare global {
	interface Window {
		spotStorage: SpotStorageApi;
		spotBackupLocation: SpotBackupLocationApi;
		spotAppInfo: SpotAppInfoApi;
		spotAppMenu: SpotAppMenuApi;
		spotDiagnostics: SpotDiagnosticsApi;
	}
}

export {};
