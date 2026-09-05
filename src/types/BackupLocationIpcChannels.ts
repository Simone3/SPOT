export const SPOT_BACKUP_LOCATION_IPC_CHANNELS = {
	getBackupLocation: 'spot-backup-location:get-backup-location',
	chooseBackupDirectory: 'spot-backup-location:choose-backup-directory',
	setBackupDirectory: 'spot-backup-location:set-backup-directory',
	setDefaultBackupDirectory: 'spot-backup-location:set-default-backup-directory',
	setRetainedBackupCount: 'spot-backup-location:set-retained-backup-count'
} as const;
