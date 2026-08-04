import 'src/components/storage/BackupSettings.css';
import { useContext, useEffect, useState, type ReactElement } from 'react';
import { ConfirmModal } from 'src/components/common/ConfirmModal';
import { Button } from 'src/components/inputs/Button';
import { BACKUP_CONFIG } from 'src/config/AppConfig';
import { BackupLocationContext } from 'src/contexts/BackupLocationContext';
import type { BackupStatus, SpotStorageApi } from 'src/types/TaskStorageTypes';

const DEVELOPMENT_NOTICE = 'Development run: the backup folder can be changed to test the app, but the next development startup goes back to the development folder.';

interface BackupFeedback {
	role: 'alert' | 'status';
	message: string;
}

const createBackupStatusMessage = (backupStatus: BackupStatus | undefined): BackupFeedback | undefined => {
	if(!backupStatus) {
		return undefined;
	}

	if(backupStatus.state === 'failed') {
		return {
			role: 'alert',
			message: `The last backup could not be written. Your tasks are still saved. ${backupStatus.message ?? ''}`.trim()
		};
	}

	if(backupStatus.state === 'idle') {
		return {
			role: 'status',
			message: 'No backup copy has been written yet. The next one follows your next task change.'
		};
	}

	return {
		role: 'status',
		message: `Last backup copy written on ${new Date(backupStatus.lastBackupAt ?? '').toLocaleString()}.`
	};
};

// The backup outcome arrives long after the task command that triggered it, so the status is both read once and then pushed by the main process
const useBackupStatus = (): BackupStatus | undefined => {
	const [ backupStatus, setBackupStatus ] = useState<BackupStatus | undefined>();

	useEffect(() => {
		const spotStorage = window.spotStorage as SpotStorageApi | undefined;

		if(!spotStorage) {
			return undefined;
		}

		let didCancelLoad = false;

		void spotStorage.getStorageStatus().then((status) => {
			if(!didCancelLoad) {
				setBackupStatus(status.backup);
			}
		}, () => {
			return undefined;
		});

		const unsubscribe = spotStorage.onBackupStatusChanged?.((status) => {
			setBackupStatus(status);
		});

		return () => {
			didCancelLoad = true;
			unsubscribe?.();
		};
	}, []);

	return backupStatus;
};

const BackupSettings = (): ReactElement => {
	const backupLocation = useContext(BackupLocationContext);
	const backupStatus = useBackupStatus();
	const [ pendingDirectory, setPendingDirectory ] = useState<string | undefined>();
	const [ isChangingDirectory, setIsChangingDirectory ] = useState(false);
	const [ feedback, setFeedback ] = useState<BackupFeedback | undefined>();

	const location = backupLocation?.location;
	const currentDirectory = location?.directory;
	const defaultDirectory = location?.defaultDirectory;
	const statusFeedback = feedback ?? createBackupStatusMessage(backupStatus);

	const onChooseFolder = (): void => {
		if(!backupLocation || isChangingDirectory) {
			return;
		}

		setFeedback(undefined);

		void backupLocation.chooseBackupDirectory().then((choice) => {
			if(!choice.ok) {
				if(choice.reason !== 'cancelled') {
					setFeedback({
						role: 'alert',
						message: choice.message || 'The selected folder cannot be used.'
					});
				}

				return;
			}

			if(choice.directory === currentDirectory) {
				setFeedback({
					role: 'status',
					message: 'The selected folder is already in use.'
				});

				return;
			}

			setPendingDirectory(choice.directory);
		});
	};

	const onUseDefaultFolder = (): void => {
		if(!defaultDirectory || isChangingDirectory) {
			return;
		}

		setFeedback(undefined);

		if(defaultDirectory === currentDirectory) {
			setFeedback({
				role: 'status',
				message: 'The default folder is already in use.'
			});

			return;
		}

		setPendingDirectory(defaultDirectory);
	};

	const onConfirmChange = (): void => {
		if(!backupLocation || !pendingDirectory) {
			return;
		}

		const directory = pendingDirectory;

		setPendingDirectory(undefined);
		setIsChangingDirectory(true);

		const change = directory === defaultDirectory ?
			backupLocation.applyDefaultBackupDirectory() :
			backupLocation.applyBackupDirectory(directory);

		void change
			.then((outcome) => {
				setFeedback(outcome.ok ?
					{
						role: 'status',
						message: `Backup copies are now written to "${directory}".`
					} :
					{
						role: 'alert',
						message: outcome.message || 'The backup folder could not be changed.'
					});
			})
			.finally(() => {
				setIsChangingDirectory(false);
			});
	};

	return (
		<div className='backup-settings'>
			<h3 className='backup-settings-title'>Task database</h3>
			<p className='backup-settings-description'>
				SPOT keeps all your tasks in a single spot.sqlite database inside its own application folder. This is always where your
				tasks are read from and written to, and it cannot be moved.
			</p>
			<p className='backup-settings-directory'>{location?.databasePath || 'Unknown.'}</p>

			<h3 className='backup-settings-title backup-settings-title-spaced'>Backup folder</h3>
			<p className='backup-settings-description'>
				A complete copy of the database is written here a couple of minutes after you stop making changes, and once more when SPOT
				closes. The {BACKUP_CONFIG.retainedBackupCount} most recent copies are kept and the older ones are removed.
			</p>
			<p className='backup-settings-warning'>
				This folder is a backup destination, not a shared one. A folder synchronized by OneDrive, Google Drive, Dropbox or iCloud is
				safe to use, because each copy is written as one finished file. SPOT never reads these copies back though: it does not keep two
				computers in sync, and restoring a backup is a manual step.
			</p>
			<p className='backup-settings-directory'>{currentDirectory || 'No folder is selected.'}</p>
			{location?.isDevelopment &&
				<p className='backup-settings-notice'>{DEVELOPMENT_NOTICE}</p>
			}
			{location?.message &&
				<p className='backup-settings-notice' role='alert'>{location.message}</p>
			}
			<div className='backup-settings-actions'>
				<Button
					label='Change folder...'
					onClick={onChooseFolder}
				/>
				{defaultDirectory &&
					<Button
						label='Use default folder'
						onClick={onUseDefaultFolder}
					/>
				}
			</div>
			{isChangingDirectory &&
				<p className='backup-settings-feedback' role='status'>Changing the backup folder...</p>
			}
			{!isChangingDirectory && statusFeedback &&
				<p
					className={`backup-settings-feedback ${statusFeedback.role === 'alert' ? 'backup-settings-feedback-error' : ''}`}
					role={statusFeedback.role}>
					{statusFeedback.message}
				</p>
			}
			{pendingDirectory &&
				<ConfirmModal
					title='Change the backup folder?'
					content={
						<>
							<p>Current folder: {currentDirectory}</p>
							<p>New folder: {pendingDirectory}</p>
							<p>The copies already written to the current folder are left where they are.</p>
							<p>Your tasks are not moved: they stay in the database in the SPOT application folder.</p>
						</>
					}
					confirmText='Change folder'
					onConfirm={onConfirmChange}
					cancelText='Cancel'
					onCancel={() => {
						setPendingDirectory(undefined);
					}}
				/>
			}
		</div>
	);
};

export { BackupSettings };
