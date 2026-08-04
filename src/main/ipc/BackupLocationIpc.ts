import type { BrowserWindow, Dialog, IpcMain, OpenDialogOptions } from 'electron';
import type { BackupLocationManager } from 'src/main/config/BackupLocationManager';
import { validateBackupDirectory } from 'src/main/storage/BackupDirectory';
import { SPOT_BACKUP_LOCATION_IPC_CHANNELS } from 'src/types/BackupLocationIpcChannels';
import type { ChooseBackupDirectoryResult } from 'src/types/BackupLocationTypes';

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

const createOpenDialogOptions = (defaultPath: string): OpenDialogOptions => {
	return {
		title: BACKUP_DIRECTORY_DIALOG_TITLE,
		message: BACKUP_DIRECTORY_DIALOG_MESSAGE,
		buttonLabel: BACKUP_DIRECTORY_DIALOG_BUTTON_LABEL,
		defaultPath,
		properties: [ 'openDirectory', 'createDirectory' ]
	};
};

export const registerBackupLocationIpcHandlers = ({
	ipcMain,
	dialog,
	backupLocationManager,
	getParentWindow
}: RegisterBackupLocationIpcHandlersOptions): void => {
	const chooseBackupDirectory = async(): Promise<ChooseBackupDirectoryResult> => {
		const location = backupLocationManager.getLocation();
		const dialogOptions = createOpenDialogOptions(location.directory || location.defaultDirectory);
		const parentWindow = getParentWindow?.();
		const dialogResult = await (parentWindow ? dialog.showOpenDialog(parentWindow, dialogOptions) : dialog.showOpenDialog(dialogOptions));
		const directory = dialogResult.filePaths[0];

		if(dialogResult.canceled || !directory) {
			return {
				ok: false,
				reason: 'cancelled'
			};
		}

		const validation = validateBackupDirectory(directory);

		if(!validation.ok) {
			return {
				ok: false,
				reason: 'invalid-directory',
				message: validation.message
			};
		}

		return {
			ok: true,
			directory
		};
	};

	ipcMain.handle(SPOT_BACKUP_LOCATION_IPC_CHANNELS.getBackupLocation, () => {
		return backupLocationManager.getLocation();
	});

	ipcMain.handle(SPOT_BACKUP_LOCATION_IPC_CHANNELS.chooseBackupDirectory, () => {
		return chooseBackupDirectory();
	});

	ipcMain.handle(SPOT_BACKUP_LOCATION_IPC_CHANNELS.setBackupDirectory, (_event, directory: string) => {
		return backupLocationManager.setBackupDirectory(directory);
	});

	ipcMain.handle(SPOT_BACKUP_LOCATION_IPC_CHANNELS.setDefaultBackupDirectory, () => {
		return backupLocationManager.setDefaultBackupDirectory();
	});
};
