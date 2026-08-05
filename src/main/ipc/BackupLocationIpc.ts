import type { BrowserWindow, Dialog, IpcMain } from 'electron';
import type { BackupLocationManager } from 'src/framework/main/config/BackupLocationManager';
import { registerBackupLocationIpcHandlers as registerFrameworkBackupLocationIpcHandlers } from 'src/framework/main/ipc/BackupLocationIpc';
import { SPOT_BACKUP_LOCATION_IPC_CHANNELS } from 'src/types/BackupLocationIpcChannels';

export const BACKUP_DIRECTORY_DIALOG_TITLE = 'Choose the SPOT backup folder';
export const BACKUP_DIRECTORY_DIALOG_MESSAGE = 'Choose the folder where SPOT writes backup copies of the task database.';
export const BACKUP_DIRECTORY_DIALOG_BUTTON_LABEL = 'Use this folder';

export { SPOT_BACKUP_LOCATION_IPC_CHANNELS } from 'src/types/BackupLocationIpcChannels';

type BackupLocationIpcMain = Pick<IpcMain, 'handle'>;

type BackupLocationDialog = Pick<Dialog, 'showOpenDialog'>;

export interface RegisterBackupLocationIpcHandlersOptions {
	ipcMain: BackupLocationIpcMain;
	dialog: BackupLocationDialog;
	backupLocationManager: BackupLocationManager;
	getParentWindow?: () => BrowserWindow | undefined;
}

// Names the SPOT backup folder channels and the wording of the native folder dialog
export const registerBackupLocationIpcHandlers = ({
	ipcMain,
	dialog,
	backupLocationManager,
	getParentWindow
}: RegisterBackupLocationIpcHandlersOptions): void => {
	registerFrameworkBackupLocationIpcHandlers({
		ipcMain,
		dialog,
		channels: SPOT_BACKUP_LOCATION_IPC_CHANNELS,
		dialogLabels: {
			title: BACKUP_DIRECTORY_DIALOG_TITLE,
			message: BACKUP_DIRECTORY_DIALOG_MESSAGE,
			buttonLabel: BACKUP_DIRECTORY_DIALOG_BUTTON_LABEL
		},
		backupLocationManager,
		getParentWindow
	});
};
