import type { BrowserWindow, Dialog, IpcMain } from 'electron';
import type { BackupLocationManager } from 'src/framework/main/config/BackupLocationManager';
import { registerBackupLocationIpcHandlers as registerFrameworkBackupLocationIpcHandlers } from 'src/framework/main/ipc/BackupLocationIpc';
import type { SpotTranslator } from 'src/i18n/Translations';
import { SPOT_BACKUP_LOCATION_IPC_CHANNELS } from 'src/types/BackupLocationIpcChannels';

export { SPOT_BACKUP_LOCATION_IPC_CHANNELS } from 'src/types/BackupLocationIpcChannels';

type BackupLocationIpcMain = Pick<IpcMain, 'handle'>;

type BackupLocationDialog = Pick<Dialog, 'showOpenDialog'>;

export interface RegisterBackupLocationIpcHandlersOptions {
	ipcMain: BackupLocationIpcMain;
	dialog: BackupLocationDialog;
	backupLocationManager: BackupLocationManager;

	// Words the native folder dialog, which names the application and so cannot be worded by the framework
	translator: SpotTranslator;
	getParentWindow?: () => BrowserWindow | undefined;
}

// Names the SPOT backup folder channels and the wording of the native folder dialog
export const registerBackupLocationIpcHandlers = ({
	ipcMain,
	dialog,
	backupLocationManager,
	translator,
	getParentWindow
}: RegisterBackupLocationIpcHandlersOptions): void => {
	registerFrameworkBackupLocationIpcHandlers({
		ipcMain,
		dialog,
		channels: SPOT_BACKUP_LOCATION_IPC_CHANNELS,
		dialogLabels: {
			title: translator.t('backup.dialog.title'),
			message: translator.t('backup.dialog.message'),
			buttonLabel: translator.t('backup.dialog.buttonLabel')
		},
		backupLocationManager,
		getParentWindow
	});
};
