import { contextBridge, ipcRenderer } from 'electron';
import { subscribeToChannel } from 'src/framework/preload/IpcBridge';
import { SPOT_BACKUP_LOCATION_IPC_CHANNELS } from 'src/types/BackupLocationIpcChannels';
import type { SpotBackupLocationApi } from 'src/types/BackupLocationTypes';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';
import type { BackupStatus, SpotStorageApi } from 'src/types/TaskStorageTypes';

const spotBackupLocation: SpotBackupLocationApi = {
	getBackupLocation: () => {
		return ipcRenderer.invoke(SPOT_BACKUP_LOCATION_IPC_CHANNELS.getBackupLocation);
	},
	chooseBackupDirectory: () => {
		return ipcRenderer.invoke(SPOT_BACKUP_LOCATION_IPC_CHANNELS.chooseBackupDirectory);
	},
	setBackupDirectory: (directory) => {
		return ipcRenderer.invoke(SPOT_BACKUP_LOCATION_IPC_CHANNELS.setBackupDirectory, directory);
	},
	setDefaultBackupDirectory: () => {
		return ipcRenderer.invoke(SPOT_BACKUP_LOCATION_IPC_CHANNELS.setDefaultBackupDirectory);
	}
};

const spotStorage: SpotStorageApi = {
	loadTasks: () => {
		return ipcRenderer.invoke(SPOT_STORAGE_IPC_CHANNELS.loadTasks);
	},
	executeTaskCommand: (command) => {
		return ipcRenderer.invoke(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand, command);
	},
	getStorageStatus: () => {
		return ipcRenderer.invoke(SPOT_STORAGE_IPC_CHANNELS.getStorageStatus);
	},
	onFlushPendingTaskChanges: (listener) => {
		return subscribeToChannel(ipcRenderer, SPOT_STORAGE_IPC_CHANNELS.flushPendingTaskChanges, listener);
	},
	onBackupStatusChanged: (listener) => {
		return subscribeToChannel<BackupStatus>(ipcRenderer, SPOT_STORAGE_IPC_CHANNELS.backupStatusChanged, listener);
	},
	notifyPendingTaskChangesFlushed: () => {
		return ipcRenderer.invoke(SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed);
	}
};

contextBridge.exposeInMainWorld('versions', {
	node: () => {
		return process.versions.node;
	},
	chrome: () => {
		return process.versions.chrome;
	},
	electron: () => {
		return process.versions.electron;
	},
	ping: () => {
		return ipcRenderer.invoke('ping');
	}
});

contextBridge.exposeInMainWorld('spotStorage', spotStorage);
contextBridge.exposeInMainWorld('spotBackupLocation', spotBackupLocation);
