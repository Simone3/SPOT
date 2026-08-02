import 'src/components/storage/DatabaseLocationSettings.css';
import { useContext, useState, type ReactElement } from 'react';
import { ConfirmModal } from 'src/components/common/ConfirmModal';
import { Button } from 'src/components/inputs/Button';
import { DatabaseLocationContext } from 'src/contexts/DatabaseLocationContext';

const DEVELOPMENT_NOTICE = 'Development run: the folder can be changed to test the app, but the next development startup goes back to the development folder.';

interface PendingDatabaseDirectoryChange {
	directory: string;
	hasExistingDatabase?: boolean;
}

interface DatabaseLocationFeedback {
	role: 'alert' | 'status';
	message: string;
}

const createExistingDatabaseMessage = (hasExistingDatabase: boolean | undefined): string => {
	if(hasExistingDatabase === undefined) {
		return 'If the folder does not contain a SPOT database, a new empty one is created.';
	}

	return hasExistingDatabase ?
		'The folder already contains a SPOT database: its tasks are loaded.' :
		'The folder does not contain a SPOT database: a new empty one is created.';
};

const DatabaseLocationSettings = (): ReactElement => {
	const databaseLocation = useContext(DatabaseLocationContext);
	const [ pendingChange, setPendingChange ] = useState<PendingDatabaseDirectoryChange | undefined>();
	const [ isChangingDirectory, setIsChangingDirectory ] = useState(false);
	const [ feedback, setFeedback ] = useState<DatabaseLocationFeedback | undefined>();

	const currentDirectory = databaseLocation?.location?.directory;
	const defaultDirectory = databaseLocation?.location?.defaultDirectory;

	const onChooseFolder = (): void => {
		if(!databaseLocation || isChangingDirectory) {
			return;
		}

		setFeedback(undefined);

		void databaseLocation.chooseDatabaseDirectory().then((choice) => {
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

			setPendingChange({
				directory: choice.directory,
				hasExistingDatabase: choice.hasExistingDatabase
			});
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

		setPendingChange({ directory: defaultDirectory });
	};

	const onConfirmChange = (): void => {
		if(!databaseLocation || !pendingChange) {
			return;
		}

		const { directory } = pendingChange;
		const isDefaultDirectory = directory === defaultDirectory;

		setPendingChange(undefined);
		setIsChangingDirectory(true);

		const change = isDefaultDirectory ?
			databaseLocation.applyDefaultDatabaseDirectory() :
			databaseLocation.applyDatabaseDirectory(directory);

		void change
			.then((outcome) => {
				setFeedback(outcome.ok ?
					{
						role: 'status',
						message: `Tasks are now stored in "${directory}".`
					} :
					{
						role: 'alert',
						message: outcome.message || 'The task database folder could not be changed.'
					});
			})
			.finally(() => {
				setIsChangingDirectory(false);
			});
	};

	return (
		<div className='database-location-settings'>
			<h3 className='database-location-settings-title'>Tasks folder</h3>
			<p className='database-location-settings-description'>
				SPOT keeps all your tasks in a single spot.sqlite database file inside this folder.
			</p>
			<p className='database-location-settings-directory'>{currentDirectory || 'No folder is selected.'}</p>
			{databaseLocation?.location?.isDevelopment &&
				<p className='database-location-settings-notice'>{DEVELOPMENT_NOTICE}</p>
			}
			<div className='database-location-settings-actions'>
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
				<p className='database-location-settings-feedback' role='status'>Changing the task database folder...</p>
			}
			{!isChangingDirectory && feedback &&
				<p
					className={`database-location-settings-feedback ${feedback.role === 'alert' ? 'database-location-settings-feedback-error' : ''}`}
					role={feedback.role}>
					{feedback.message}
				</p>
			}
			{pendingChange &&
				<ConfirmModal
					title='Change the tasks folder?'
					content={
						<>
							<p>Current folder: {currentDirectory}</p>
							<p>New folder: {pendingChange.directory}</p>
							<p>{createExistingDatabaseMessage(pendingChange.hasExistingDatabase)}</p>
							<p>SPOT finishes the task changes still pending on the current database, then reloads everything from the new folder.</p>
						</>
					}
					confirmText='Change folder'
					onConfirm={onConfirmChange}
					cancelText='Cancel'
					onCancel={() => {
						setPendingChange(undefined);
					}}
				/>
			}
		</div>
	);
};

export { DatabaseLocationSettings };
