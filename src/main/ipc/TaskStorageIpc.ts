import type { App, IpcMain } from 'electron';
import { SHUTDOWN_CONFIG } from 'src/config/AppConfig';
import { registerStorageIpcHandlers, type RendererFlushTarget, type StorageCommandController } from 'src/framework/main/ipc/StorageCommandIpc';
import type { TaskStorage } from 'src/main/storage/TaskStorage';
import { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';
import type { LoadTasksResult, TaskStorageCommand } from 'src/types/TaskStorageTypes';

export const TASK_STORAGE_SHUTDOWN_MESSAGE = 'Task storage is shutting down.';
export { SPOT_STORAGE_IPC_CHANNELS } from 'src/types/TaskStorageIpcChannels';
export type { RendererFlushTarget, StorageCommandController as TaskStorageCommandController } from 'src/framework/main/ipc/StorageCommandIpc';

type TaskStorageIpcMain = Pick<IpcMain, 'handle'>;

type TaskStorageIpcApp = Partial<Pick<App, 'on' | 'quit'>>;

type TaskStorageIpcApi = Pick<TaskStorage, 'loadTasks' | 'executeTaskCommand' | 'getStorageStatus'> & Partial<Pick<TaskStorage, 'prepareForShutdown'>>;

export interface RegisterTaskStorageIpcHandlersOptions {
	ipcMain: TaskStorageIpcMain;
	taskStorage: TaskStorageIpcApi;
	app?: TaskStorageIpcApp;
	getRendererFlushTarget?: () => RendererFlushTarget | undefined;

	// Called after every command that reached the database, so the backup schedule can be restarted
	onTaskCommandApplied?: () => void;

	// Called once the in-flight commands are done and before the database is closed, so a last backup can still read it
	onBeforeStorageShutdown?: () => Promise<void>;
}

// Names the SPOT storage channels and hands the task operations to the framework controller that serializes them and drains them on shutdown
export const registerTaskStorageIpcHandlers = ({
	ipcMain,
	taskStorage,
	app,
	getRendererFlushTarget,
	onTaskCommandApplied,
	onBeforeStorageShutdown
}: RegisterTaskStorageIpcHandlersOptions): StorageCommandController => {
	return registerStorageIpcHandlers<TaskStorageCommand, LoadTasksResult>({
		ipcMain,
		channels: {
			load: SPOT_STORAGE_IPC_CHANNELS.loadTasks,
			execute: SPOT_STORAGE_IPC_CHANNELS.executeTaskCommand,
			getStatus: SPOT_STORAGE_IPC_CHANNELS.getStorageStatus,
			flushPendingChanges: SPOT_STORAGE_IPC_CHANNELS.flushPendingTaskChanges,
			pendingChangesFlushed: SPOT_STORAGE_IPC_CHANNELS.pendingTaskChangesFlushed
		},
		storage: {
			load: () => {
				return taskStorage.loadTasks();
			},
			execute: (command) => {
				return taskStorage.executeTaskCommand(command);
			},
			getStorageStatus: () => {
				return taskStorage.getStorageStatus();
			},
			prepareForShutdown: taskStorage.prepareForShutdown && (() => {
				return taskStorage.prepareForShutdown?.() ?? Promise.resolve();
			})
		},
		rendererFlushTimeoutMs: SHUTDOWN_CONFIG.rendererFlushTimeoutMs,
		shutdownMessage: TASK_STORAGE_SHUTDOWN_MESSAGE,
		app,
		getRendererFlushTarget,
		onCommandApplied: onTaskCommandApplied,
		onBeforeStorageShutdown
	});
};
