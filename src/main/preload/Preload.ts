import { contextBridge, ipcRenderer } from 'electron';
import { SPOT_DATABASE_LOCATION_IPC_CHANNELS } from 'src/types/DatabaseLocationIpcChannels';
import type { SpotDatabaseLocationApi } from 'src/types/DatabaseLocationTypes';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';
import type { SpotStorageApi } from 'src/types/TaskStorageTypes';

const spotDatabaseLocation: SpotDatabaseLocationApi = {
	getDatabaseLocation: () => {
		return ipcRenderer.invoke(SPOT_DATABASE_LOCATION_IPC_CHANNELS.getDatabaseLocation);
	},
	chooseDatabaseDirectory: () => {
		return ipcRenderer.invoke(SPOT_DATABASE_LOCATION_IPC_CHANNELS.chooseDatabaseDirectory);
	},
	setDatabaseDirectory: (directory) => {
		return ipcRenderer.invoke(SPOT_DATABASE_LOCATION_IPC_CHANNELS.setDatabaseDirectory, directory);
	},
	setDefaultDatabaseDirectory: () => {
		return ipcRenderer.invoke(SPOT_DATABASE_LOCATION_IPC_CHANNELS.setDefaultDatabaseDirectory);
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
		const flushListener = (): void => {
			listener();
		};

		ipcRenderer.on(SPOT_STORAGE_IPC_CHANNELS.flushPendingTaskChanges, flushListener);

		return () => {
			ipcRenderer.removeListener(SPOT_STORAGE_IPC_CHANNELS.flushPendingTaskChanges, flushListener);
		};
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
contextBridge.exposeInMainWorld('spotDatabaseLocation', spotDatabaseLocation);
