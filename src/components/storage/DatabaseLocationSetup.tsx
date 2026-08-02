import 'src/components/storage/DatabaseLocationSetup.css';
import { useContext, useState, type ReactElement } from 'react';
import { Button } from 'src/components/inputs/Button';
import { DatabaseLocationContext } from 'src/contexts/DatabaseLocationContext';

const SETUP_TITLE = 'Choose where SPOT stores your tasks';

const SETUP_DESCRIPTION = 'SPOT keeps all your tasks in a single spot.sqlite database file. Choose the folder that holds it: if the folder already contains a SPOT database it is opened, otherwise a new empty one is created. A folder synced by Google Drive, OneDrive, or Dropbox works as a backup across devices.';

const DatabaseLocationSetup = (): ReactElement => {
	const databaseLocation = useContext(DatabaseLocationContext);
	const [ isChangingDirectory, setIsChangingDirectory ] = useState(false);
	const [ errorMessage, setErrorMessage ] = useState<string | undefined>();

	const defaultDirectory = databaseLocation?.location?.defaultDirectory;
	const message = errorMessage || databaseLocation?.location?.message;

	const runDirectoryChange = (change: () => Promise<void>): void => {
		if(isChangingDirectory) {
			return;
		}

		setIsChangingDirectory(true);
		setErrorMessage(undefined);

		void change().finally(() => {
			setIsChangingDirectory(false);
		});
	};

	const onChooseFolder = (): void => {
		runDirectoryChange(async() => {
			if(!databaseLocation) {
				return;
			}

			const choice = await databaseLocation.chooseDatabaseDirectory();

			if(!choice.ok) {
				if(choice.reason !== 'cancelled') {
					setErrorMessage(choice.message);
				}

				return;
			}

			const outcome = await databaseLocation.applyDatabaseDirectory(choice.directory);

			if(!outcome.ok) {
				setErrorMessage(outcome.message);
			}
		});
	};

	const onUseDefaultFolder = (): void => {
		runDirectoryChange(async() => {
			if(!databaseLocation) {
				return;
			}

			const outcome = await databaseLocation.applyDefaultDatabaseDirectory();

			if(!outcome.ok) {
				setErrorMessage(outcome.message);
			}
		});
	};

	return (
		<div className='database-location-setup'>
			<div className='database-location-setup-card'>
				<h1 className='database-location-setup-title'>{SETUP_TITLE}</h1>
				<p className='database-location-setup-description'>{SETUP_DESCRIPTION}</p>
				{message &&
					<p className='database-location-setup-error' role='alert'>{message}</p>
				}
				<div className='database-location-setup-actions'>
					<Button
						className='database-location-setup-choose'
						label='Choose folder...'
						onClick={onChooseFolder}
					/>
					{defaultDirectory &&
						<Button
							label='Use default folder'
							onClick={onUseDefaultFolder}
						/>
					}
				</div>
				{defaultDirectory &&
					<p className='database-location-setup-default'>Default folder: {defaultDirectory}</p>
				}
				{isChangingDirectory &&
					<p className='database-location-setup-status' role='status'>Opening the task database...</p>
				}
			</div>
		</div>
	);
};

export { DatabaseLocationSetup };
