export const SPOT_STORAGE_IPC_CHANNELS = {
	loadTasks: 'spot-storage:load-tasks',
	executeTaskCommand: 'spot-storage:execute-task-command',
	getStorageStatus: 'spot-storage:get-storage-status',
	flushPendingTaskChanges: 'spot-storage:flush-pending-task-changes',
	pendingTaskChangesFlushed: 'spot-storage:pending-task-changes-flushed',
	backupStatusChanged: 'spot-storage:backup-status-changed'
} as const;
