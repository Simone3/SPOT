import { contextBridge, ipcRenderer } from 'electron';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';
import type { SpotStorageApi } from 'src/types/TaskStorageTypes';

const spotStorage: SpotStorageApi = {
	loadTasks: () => {
		return ipcRenderer.invoke(SPOT_STORAGE_IPC_CHANNELS.loadTasks);
	},
	executeTaskCommand: (command) => {
		return ipcRenderer.invoke(SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand, command);
	},
	getStorageStatus: () => {
		return ipcRenderer.invoke(SPOT_STORAGE_IPC_CHANNELS.getStorageStatus);
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
