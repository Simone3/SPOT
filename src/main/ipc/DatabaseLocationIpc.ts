import type { BrowserWindow, Dialog, IpcMain, OpenDialogOptions } from 'electron';
import type { DatabaseLocationManager } from 'src/main/config/DatabaseLocationManager';
import { hasExistingSpotDatabase, validateDatabaseDirectory } from 'src/main/storage/DatabaseDirectory';
import { SPOT_DATABASE_LOCATION_IPC_CHANNELS } from 'src/types/DatabaseLocationIpcChannels';
import type { ChooseDatabaseDirectoryResult } from 'src/types/DatabaseLocationTypes';

export const DATABASE_DIRECTORY_DIALOG_TITLE = 'Choose the SPOT tasks folder';
export const DATABASE_DIRECTORY_DIALOG_MESSAGE = 'Choose the folder where SPOT keeps the spot.sqlite task database.';
export const DATABASE_DIRECTORY_DIALOG_BUTTON_LABEL = 'Use this folder';

export { SPOT_DATABASE_LOCATION_IPC_CHANNELS } from 'src/types/DatabaseLocationIpcChannels';

type DatabaseLocationIpcMain = Pick<IpcMain, 'handle'>;

type DatabaseLocationDialog = Pick<Dialog, 'showOpenDialog'>;

export interface RegisterDatabaseLocationIpcHandlersOptions {
	ipcMain: DatabaseLocationIpcMain;
	dialog: DatabaseLocationDialog;
	databaseLocationManager: DatabaseLocationManager;
	getParentWindow?: () => BrowserWindow | undefined;
}

const createOpenDialogOptions = (defaultPath: string): OpenDialogOptions => {
	return {
		title: DATABASE_DIRECTORY_DIALOG_TITLE,
		message: DATABASE_DIRECTORY_DIALOG_MESSAGE,
		buttonLabel: DATABASE_DIRECTORY_DIALOG_BUTTON_LABEL,
		defaultPath,
		properties: [ 'openDirectory', 'createDirectory' ]
	};
};

export const registerDatabaseLocationIpcHandlers = ({
	ipcMain,
	dialog,
	databaseLocationManager,
	getParentWindow
}: RegisterDatabaseLocationIpcHandlersOptions): void => {
	const chooseDatabaseDirectory = async(): Promise<ChooseDatabaseDirectoryResult> => {
		const location = databaseLocationManager.getLocation();
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

		const validation = validateDatabaseDirectory(directory);

		if(!validation.ok) {
			return {
				ok: false,
				reason: 'invalid-directory',
				message: validation.message
			};
		}

		return {
			ok: true,
			directory,
			hasExistingDatabase: hasExistingSpotDatabase(directory)
		};
	};

	ipcMain.handle(SPOT_DATABASE_LOCATION_IPC_CHANNELS.getDatabaseLocation, () => {
		return databaseLocationManager.getLocation();
	});

	ipcMain.handle(SPOT_DATABASE_LOCATION_IPC_CHANNELS.chooseDatabaseDirectory, () => {
		return chooseDatabaseDirectory();
	});

	ipcMain.handle(SPOT_DATABASE_LOCATION_IPC_CHANNELS.setDatabaseDirectory, (_event, directory: string) => {
		return databaseLocationManager.setDatabaseDirectory(directory);
	});

	ipcMain.handle(SPOT_DATABASE_LOCATION_IPC_CHANNELS.setDefaultDatabaseDirectory, () => {
		return databaseLocationManager.setDefaultDatabaseDirectory();
	});
};
