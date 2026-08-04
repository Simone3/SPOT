import { createContext, useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import type { BackupLocation, ChooseBackupDirectoryResult, SetBackupDirectoryResult, SpotBackupLocationApi } from 'src/types/BackupLocationTypes';

export const ELECTRON_BACKUP_LOCATION_API_UNAVAILABLE_MESSAGE = 'SPOT must be opened from the Electron app.';

export interface ApplyBackupDirectoryOutcome {
	ok: boolean;
	message?: string;
}

export interface BackupLocationContextValue {
	location: BackupLocation | undefined;
	isLoading: boolean;
	loadErrorMessage: string | undefined;
	chooseBackupDirectory: () => Promise<ChooseBackupDirectoryResult>;
	applyBackupDirectory: (directory: string) => Promise<ApplyBackupDirectoryOutcome>;
	applyDefaultBackupDirectory: () => Promise<ApplyBackupDirectoryOutcome>;
}

export const BackupLocationContext = createContext<BackupLocationContextValue | undefined>(undefined);

type BackupLocationContextProviderProps = {
	children: ReactNode;
};

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	return String(error);
};

const getBackupLocationApi = (): SpotBackupLocationApi | undefined => {
	return window.spotBackupLocation;
};

// Changing the backup folder never touches the database, so nothing has to be flushed or reloaded when it changes
export const BackupLocationContextProvider = ({ children }: BackupLocationContextProviderProps): ReactElement => {
	const [ location, setLocation ] = useState<BackupLocation | undefined>();
	const [ isLoading, setIsLoading ] = useState(true);
	const [ loadErrorMessage, setLoadErrorMessage ] = useState<string | undefined>();

	useEffect(() => {
		let didCancelLoad = false;
		const backupLocationApi = getBackupLocationApi();

		if(!backupLocationApi) {
			setLoadErrorMessage(ELECTRON_BACKUP_LOCATION_API_UNAVAILABLE_MESSAGE);
			setIsLoading(false);

			return undefined;
		}

		const loadBackupLocation = async(): Promise<void> => {
			try {
				const loadedLocation = await backupLocationApi.getBackupLocation();

				if(!didCancelLoad) {
					setLocation(loadedLocation);
					setIsLoading(false);
				}
			}
			catch(error) {
				if(!didCancelLoad) {
					setLoadErrorMessage(getErrorMessage(error));
					setIsLoading(false);
				}
			}
		};

		void loadBackupLocation();

		return () => {
			didCancelLoad = true;
		};
	}, []);

	const chooseBackupDirectory = useCallback((): Promise<ChooseBackupDirectoryResult> => {
		const backupLocationApi = getBackupLocationApi();

		if(!backupLocationApi) {
			return Promise.resolve({
				ok: false,
				reason: 'invalid-directory',
				message: ELECTRON_BACKUP_LOCATION_API_UNAVAILABLE_MESSAGE
			});
		}

		return backupLocationApi.chooseBackupDirectory();
	}, []);

	const runBackupDirectoryChange = useCallback(async(
		change: (backupLocationApi: SpotBackupLocationApi) => Promise<SetBackupDirectoryResult>
	): Promise<ApplyBackupDirectoryOutcome> => {
		const backupLocationApi = getBackupLocationApi();

		if(!backupLocationApi) {
			return {
				ok: false,
				message: ELECTRON_BACKUP_LOCATION_API_UNAVAILABLE_MESSAGE
			};
		}

		try {
			const result = await change(backupLocationApi);
			setLocation(result.location);

			return result.ok ?
				{ ok: true } :
				{
					ok: false,
					message: result.message
				};
		}
		catch(error) {
			return {
				ok: false,
				message: getErrorMessage(error)
			};
		}
	}, []);

	const applyBackupDirectory = useCallback((directory: string): Promise<ApplyBackupDirectoryOutcome> => {
		return runBackupDirectoryChange((backupLocationApi) => {
			return backupLocationApi.setBackupDirectory(directory);
		});
	}, [ runBackupDirectoryChange ]);

	const applyDefaultBackupDirectory = useCallback((): Promise<ApplyBackupDirectoryOutcome> => {
		return runBackupDirectoryChange((backupLocationApi) => {
			return backupLocationApi.setDefaultBackupDirectory();
		});
	}, [ runBackupDirectoryChange ]);

	const contextValue = useMemo((): BackupLocationContextValue => {
		return {
			location,
			isLoading,
			loadErrorMessage,
			chooseBackupDirectory,
			applyBackupDirectory,
			applyDefaultBackupDirectory
		};
	}, [ location, isLoading, loadErrorMessage, chooseBackupDirectory, applyBackupDirectory, applyDefaultBackupDirectory ]);

	return (
		<BackupLocationContext.Provider value={contextValue}>
			{children}
		</BackupLocationContext.Provider>
	);
};
