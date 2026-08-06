import 'src/components/storage/BackupSettings.css';
import { useContext, useEffect, useState, type ReactElement } from 'react';
import { ConfirmModal } from 'src/components/common/ConfirmModal';
import { Button } from 'src/components/inputs/Button';
import { BACKUP_CONFIG } from 'src/config/AppConfig';
import { BackupLocationContext } from 'src/contexts/BackupLocationContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SpotTranslator } from 'src/i18n/Translations';
import type { BackupStatus, SpotStorageApi } from 'src/types/TaskStorageTypes';

interface BackupFeedback {
	role: 'alert' | 'status';
	message: string;
}

const createBackupStatusMessage = (backupStatus: BackupStatus | undefined, translator: SpotTranslator): BackupFeedback | undefined => {
	if(!backupStatus) {
		return undefined;
	}

	if(backupStatus.state === 'failed') {
		return {
			role: 'alert',
			message: backupStatus.message ?
				translator.t('backup.status.failedWithMessage', { message: backupStatus.message }) :
				translator.t('backup.status.failed')
		};
	}

	if(backupStatus.state === 'idle') {
		return {
			role: 'status',
			message: translator.t('backup.status.idle')
		};
	}

	return {
		role: 'status',
		message: translator.t('backup.status.lastWritten', {
			timestamp: new Date(backupStatus.lastBackupAt ?? '').toLocaleString(translator.locale)
		})
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
	const translator = useTranslator();
	const { t } = translator;
	const backupLocation = useContext(BackupLocationContext);
	const backupStatus = useBackupStatus();
	const [ pendingDirectory, setPendingDirectory ] = useState<string | undefined>();
	const [ isChangingDirectory, setIsChangingDirectory ] = useState(false);
	const [ feedback, setFeedback ] = useState<BackupFeedback | undefined>();

	const location = backupLocation?.location;
	const currentDirectory = location?.directory;
	const defaultDirectory = location?.defaultDirectory;
	const statusFeedback = feedback ?? createBackupStatusMessage(backupStatus, translator);

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
						message: choice.message || t('backup.folderUnusable')
					});
				}

				return;
			}

			if(choice.directory === currentDirectory) {
				setFeedback({
					role: 'status',
					message: t('backup.folderAlreadyInUse')
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
				message: t('backup.defaultFolderAlreadyInUse')
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
						message: t('backup.folderChanged', { directory })
					} :
					{
						role: 'alert',
						message: outcome.message || t('backup.folderChangeFailed')
					});
			})
			.finally(() => {
				setIsChangingDirectory(false);
			});
	};

	return (
		<div className='backup-settings'>
			<h3 className='backup-settings-title'>{t('backup.databaseTitle')}</h3>
			<p className='backup-settings-description'>{t('backup.databaseDescription')}</p>
			<p className='backup-settings-directory'>{location?.databasePath || t('backup.unknownDatabasePath')}</p>

			<h3 className='backup-settings-title backup-settings-title-spaced'>{t('backup.folderTitle')}</h3>
			<p className='backup-settings-description'>
				{t('backup.folderDescription', { retainedBackupCount: BACKUP_CONFIG.retainedBackupCount })}
			</p>
			<p className='backup-settings-warning'>{t('backup.folderWarning')}</p>
			<p className='backup-settings-directory'>{currentDirectory || t('backup.noFolderSelected')}</p>
			{location?.isDevelopment &&
				<p className='backup-settings-notice'>{t('backup.developmentNotice')}</p>
			}
			{location?.message &&
				<p className='backup-settings-notice' role='alert'>{location.message}</p>
			}
			<div className='backup-settings-actions'>
				<Button
					label={t('backup.changeFolder')}
					onClick={onChooseFolder}
				/>
				{defaultDirectory &&
					<Button
						label={t('backup.useDefaultFolder')}
						onClick={onUseDefaultFolder}
					/>
				}
			</div>
			{isChangingDirectory &&
				<p className='backup-settings-feedback' role='status'>{t('backup.changingFolder')}</p>
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
					title={t('backup.confirm.title')}
					content={
						<>
							<p>{t('backup.confirm.currentFolder', { directory: currentDirectory ?? '' })}</p>
							<p>{t('backup.confirm.newFolder', { directory: pendingDirectory })}</p>
							<p>{t('backup.confirm.copiesStay')}</p>
							<p>{t('backup.confirm.tasksStay')}</p>
						</>
					}
					confirmText={t('backup.confirm.confirm')}
					onConfirm={onConfirmChange}
					cancelText={t('backup.confirm.cancel')}
					onCancel={() => {
						setPendingDirectory(undefined);
					}}
				/>
			}
		</div>
	);
};

export { BackupSettings };
