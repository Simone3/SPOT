import { createContext, useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { BackupLocation, BackupSettingsResult, ChooseBackupDirectoryResult, SpotBackupLocationApi } from 'src/types/BackupLocationTypes';

export interface ApplyBackupSettingsOutcome {
	ok: boolean;
	message?: string;
}

export interface BackupLocationContextValue {
	location: BackupLocation | undefined;
	isLoading: boolean;
	loadErrorMessage: string | undefined;
	chooseBackupDirectory: () => Promise<ChooseBackupDirectoryResult>;
	applyBackupDirectory: (directory: string) => Promise<ApplyBackupSettingsOutcome>;
	applyDefaultBackupDirectory: () => Promise<ApplyBackupSettingsOutcome>;
	applyRetainedBackupCount: (retainedBackupCount: number) => Promise<ApplyBackupSettingsOutcome>;
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

// Changing the backup folder or how many copies it keeps never touches the database, so nothing has to be flushed or reloaded when either changes
export const BackupLocationContextProvider = ({ children }: BackupLocationContextProviderProps): ReactElement => {
	const { t } = useTranslator();
	const [ location, setLocation ] = useState<BackupLocation | undefined>();
	const [ isLoading, setIsLoading ] = useState(true);
	const [ loadErrorMessage, setLoadErrorMessage ] = useState<string | undefined>();

	useEffect(() => {
		let didCancelLoad = false;
		const backupLocationApi = getBackupLocationApi();

		if(!backupLocationApi) {
			setLoadErrorMessage(t('storage.electronOnly'));
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
	}, [ t ]);

	const chooseBackupDirectory = useCallback((): Promise<ChooseBackupDirectoryResult> => {
		const backupLocationApi = getBackupLocationApi();

		if(!backupLocationApi) {
			return Promise.resolve({
				ok: false,
				reason: 'invalid-directory',
				message: t('storage.electronOnly')
			});
		}

		return backupLocationApi.chooseBackupDirectory();
	}, [ t ]);

	const runBackupSettingsChange = useCallback(async(
		change: (backupLocationApi: SpotBackupLocationApi) => Promise<BackupSettingsResult>
	): Promise<ApplyBackupSettingsOutcome> => {
		const backupLocationApi = getBackupLocationApi();

		if(!backupLocationApi) {
			return {
				ok: false,
				message: t('storage.electronOnly')
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
	}, [ t ]);

	const applyBackupDirectory = useCallback((directory: string): Promise<ApplyBackupSettingsOutcome> => {
		return runBackupSettingsChange((backupLocationApi) => {
			return backupLocationApi.setBackupDirectory(directory);
		});
	}, [ runBackupSettingsChange ]);

	const applyDefaultBackupDirectory = useCallback((): Promise<ApplyBackupSettingsOutcome> => {
		return runBackupSettingsChange((backupLocationApi) => {
			return backupLocationApi.setDefaultBackupDirectory();
		});
	}, [ runBackupSettingsChange ]);

	const applyRetainedBackupCount = useCallback((retainedBackupCount: number): Promise<ApplyBackupSettingsOutcome> => {
		return runBackupSettingsChange((backupLocationApi) => {
			return backupLocationApi.setRetainedBackupCount(retainedBackupCount);
		});
	}, [ runBackupSettingsChange ]);

	const contextValue = useMemo((): BackupLocationContextValue => {
		return {
			location,
			isLoading,
			loadErrorMessage,
			chooseBackupDirectory,
			applyBackupDirectory,
			applyDefaultBackupDirectory,
			applyRetainedBackupCount
		};
	}, [ location, isLoading, loadErrorMessage, chooseBackupDirectory, applyBackupDirectory, applyDefaultBackupDirectory, applyRetainedBackupCount ]);

	return (
		<BackupLocationContext.Provider value={contextValue}>
			{children}
		</BackupLocationContext.Provider>
	);
};
