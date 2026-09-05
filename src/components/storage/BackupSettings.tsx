import 'src/components/storage/BackupSettings.css';
import { useContext, useEffect, useState, type ReactElement } from 'react';
import { ConfirmModal } from 'src/components/common/ConfirmModal';
import { Button } from 'src/components/inputs/Button';
import { NumberInput } from 'src/components/inputs/NumberInput';
import { BACKUP_CONFIG } from 'src/config/AppConfig';
import { BackupLocationContext } from 'src/contexts/BackupLocationContext';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SpotTranslator } from 'src/i18n/Translations';
import type { BackupStatus, SpotStorageApi } from 'src/types/TaskStorageTypes';

interface BackupFeedback {
	role: 'alert' | 'status';
	message: string;
}

// The folder holds two kinds of copy and they answer two different questions, so both are reported: the up-to-date one says how much
// a lost database would cost, and the newest dated one says how far back the folder still reaches
const createBackupStatusMessages = (backupStatus: BackupStatus | undefined, translator: SpotTranslator): BackupFeedback[] => {
	if(!backupStatus) {
		return [];
	}

	const { t, locale } = translator;

	if(backupStatus.state === 'failed') {
		return [ {
			role: 'alert',
			message: backupStatus.message ?
				t('backup.status.failedWithMessage', { message: backupStatus.message }) :
				t('backup.status.failed')
		} ];
	}

	if(!backupStatus.latestCopyAt) {
		return [ {
			role: 'status',
			message: t('backup.status.idle')
		} ];
	}

	return [
		{
			role: 'status',
			message: t('backup.status.latestCopy', {
				timestamp: new Date(backupStatus.latestCopyAt).toLocaleString(locale)
			})
		},
		{
			role: 'status',
			message: backupStatus.lastArchiveAt ?
				t('backup.status.lastArchive', {
					timestamp: new Date(backupStatus.lastArchiveAt).toLocaleString(locale)
				}) :
				t('backup.status.noArchiveYet')
		}
	];
};

// What the chosen count actually gets the user, which is the one thing a bare number does not say
const createRetainedBackupCountMessage = (retainedBackupCount: number, translator: SpotTranslator): string => {
	const { t } = translator;

	if(retainedBackupCount <= 0) {
		return t('backup.countNone');
	}

	if(retainedBackupCount === 1) {
		return t('backup.countLatestOnly', { latestFileName: BACKUP_CONFIG.latestFileName });
	}

	return t('backup.countHelp', {
		count: retainedBackupCount - 1,
		latestFileName: BACKUP_CONFIG.latestFileName
	});
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
	const [ isChangingCount, setIsChangingCount ] = useState(false);
	const [ feedback, setFeedback ] = useState<BackupFeedback | undefined>();

	const location = backupLocation?.location;
	const currentDirectory = location?.directory;
	const defaultDirectory = location?.defaultDirectory;
	const retainedBackupCount = location?.retainedBackupCount;

	// The field holds what is being typed rather than the applied count, so a number that is half entered is not thrown away and not
	// applied either. Nothing being typed means it simply shows the applied count, which is also how a count held to its range shows up.
	const [ editedCount, setEditedCount ] = useState<string | undefined>();
	const displayedCount = editedCount ?? (retainedBackupCount === undefined ? '' : String(retainedBackupCount));

	const statusMessages = feedback ? [ feedback ] : createBackupStatusMessages(backupStatus, translator);

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

	// A field that was left empty, or holding something that is not a number at all, goes back to the applied count rather than
	// standing for one: the main process holds the count to its range, and this is the same refusal shown before asking it to
	const onCommitCount = (): void => {
		if(!backupLocation || retainedBackupCount === undefined || isChangingCount) {
			return;
		}

		const parsedCount = Number.parseInt(displayedCount, 10);

		if(!Number.isFinite(parsedCount) || parsedCount === retainedBackupCount) {
			setEditedCount(undefined);

			return;
		}

		setFeedback(undefined);
		setIsChangingCount(true);

		void backupLocation.applyRetainedBackupCount(parsedCount)
			.then((outcome) => {
				// The applied count is what the field shows again either way: what was refused, and what was held to the range
				setEditedCount(undefined);

				if(!outcome.ok) {
					setFeedback({
						role: 'alert',
						message: outcome.message || t('backup.countChangeFailed')
					});

					return;
				}

				const appliedCount = Math.min(BACKUP_CONFIG.maximumRetainedBackupCount, Math.max(BACKUP_CONFIG.minimumRetainedBackupCount, parsedCount));

				setFeedback({
					role: 'status',
					message: appliedCount === 0 ?
						t('backup.countChangedToNone') :
						t('backup.countChanged', { count: appliedCount })
				});
			})
			.finally(() => {
				setIsChangingCount(false);
			});
	};

	return (
		<div className='backup-settings'>
			<h3 className='backup-settings-title'>{t('backup.databaseTitle')}</h3>
			<p className='backup-settings-description'>{t('backup.databaseDescription')}</p>
			<p className='backup-settings-directory'>{location?.databasePath || t('backup.unknownDatabasePath')}</p>

			<h3 className='backup-settings-title backup-settings-title-spaced'>{t('backup.folderTitle')}</h3>
			<p className='backup-settings-description'>
				{t('backup.folderDescription', { latestFileName: BACKUP_CONFIG.latestFileName })}
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

			<h3 className='backup-settings-title backup-settings-title-spaced'>{t('backup.countTitle')}</h3>
			<div className='backup-settings-count'>
				<NumberInput
					label={t('backup.countLabel')}
					value={displayedCount}
					minimum={BACKUP_CONFIG.minimumRetainedBackupCount}
					maximum={BACKUP_CONFIG.maximumRetainedBackupCount}
					disabled={retainedBackupCount === undefined || isChangingCount}
					onChange={setEditedCount}
					onCommit={onCommitCount}
				/>
				{retainedBackupCount !== undefined &&
					<p className='backup-settings-description'>{createRetainedBackupCountMessage(retainedBackupCount, translator)}</p>
				}
			</div>
			<p className='backup-settings-warning'>{t('backup.countKeepsExisting')}</p>

			{isChangingDirectory &&
				<p className='backup-settings-feedback' role='status'>{t('backup.changingFolder')}</p>
			}
			{isChangingCount &&
				<p className='backup-settings-feedback' role='status'>{t('backup.changingCount')}</p>
			}
			{!isChangingDirectory && !isChangingCount && statusMessages.map((statusMessage) => {
				return (
					<p
						key={statusMessage.message}
						className={`backup-settings-feedback ${statusMessage.role === 'alert' ? 'backup-settings-feedback-error' : ''}`}
						role={statusMessage.role}>
						{statusMessage.message}
					</p>
				);
			})}
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
