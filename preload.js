const { contextBridge, ipcRenderer } = require('electron');

const spotStorageChannels = {
	loadTasks: 'spot-storage:load-tasks',
	executeTaskCommand: 'spot-storage:execute-task-command',
	getStorageStatus: 'spot-storage:get-storage-status'
};

contextBridge.exposeInMainWorld('versions', {
	node: () => process.versions.node,
	chrome: () => process.versions.chrome,
	electron: () => process.versions.electron,
	ping: () => ipcRenderer.invoke('ping')
});

contextBridge.exposeInMainWorld('spotStorage', {
	loadTasks: () => ipcRenderer.invoke(spotStorageChannels.loadTasks),
	executeTaskCommand: (command) => ipcRenderer.invoke(spotStorageChannels.executeTaskCommand, command),
	getStorageStatus: () => ipcRenderer.invoke(spotStorageChannels.getStorageStatus)
});
