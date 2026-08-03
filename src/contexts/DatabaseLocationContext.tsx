import { createContext, useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { flushPendingTaskChanges } from 'src/logic/PendingTaskChanges';
import { waitForTaskStorageQueue } from 'src/logic/TaskStorageQueue';
import type { ChooseDatabaseDirectoryResult, DatabaseLocation, SetDatabaseDirectoryResult, SpotDatabaseLocationApi } from 'src/types/DatabaseLocationTypes';

export const ELECTRON_DATABASE_LOCATION_API_UNAVAILABLE_MESSAGE = 'SPOT must be opened from the Electron app.';

export interface ApplyDatabaseDirectoryOutcome {
	ok: boolean;
	message?: string;
}

export interface DatabaseLocationContextValue {
	location: DatabaseLocation | undefined;
	isLoading: boolean;
	loadErrorMessage: string | undefined;
	chooseDatabaseDirectory: () => Promise<ChooseDatabaseDirectoryResult>;
	applyDatabaseDirectory: (directory: string) => Promise<ApplyDatabaseDirectoryOutcome>;
	applyDefaultDatabaseDirectory: () => Promise<ApplyDatabaseDirectoryOutcome>;
}

export const DatabaseLocationContext = createContext<DatabaseLocationContextValue | undefined>(undefined);

type DatabaseLocationContextProviderProps = {
	children: ReactNode;
};

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	return String(error);
};

const getDatabaseLocationApi = (): SpotDatabaseLocationApi | undefined => {
	return window.spotDatabaseLocation;
};

export const DatabaseLocationContextProvider = ({ children }: DatabaseLocationContextProviderProps): ReactElement => {
	const [ location, setLocation ] = useState<DatabaseLocation | undefined>();
	const [ isLoading, setIsLoading ] = useState(true);
	const [ loadErrorMessage, setLoadErrorMessage ] = useState<string | undefined>();

	useEffect(() => {
		let didCancelLoad = false;
		const databaseLocationApi = getDatabaseLocationApi();

		if(!databaseLocationApi) {
			setLoadErrorMessage(ELECTRON_DATABASE_LOCATION_API_UNAVAILABLE_MESSAGE);
			setIsLoading(false);

			return undefined;
		}

		const loadDatabaseLocation = async(): Promise<void> => {
			try {
				const loadedLocation = await databaseLocationApi.getDatabaseLocation();

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

		void loadDatabaseLocation();

		return () => {
			didCancelLoad = true;
		};
	}, []);

	const chooseDatabaseDirectory = useCallback((): Promise<ChooseDatabaseDirectoryResult> => {
		const databaseLocationApi = getDatabaseLocationApi();

		if(!databaseLocationApi) {
			return Promise.resolve({
				ok: false,
				reason: 'invalid-directory',
				message: ELECTRON_DATABASE_LOCATION_API_UNAVAILABLE_MESSAGE
			});
		}

		return databaseLocationApi.chooseDatabaseDirectory();
	}, []);

	const runDatabaseDirectoryChange = useCallback(async(
		change: (databaseLocationApi: SpotDatabaseLocationApi) => Promise<SetDatabaseDirectoryResult>
	): Promise<ApplyDatabaseDirectoryOutcome> => {
		const databaseLocationApi = getDatabaseLocationApi();

		if(!databaseLocationApi) {
			return {
				ok: false,
				message: ELECTRON_DATABASE_LOCATION_API_UNAVAILABLE_MESSAGE
			};
		}

		// A task command still on its way to the main process would be applied to the new database, where its task does not
		// exist, so everything the user changed is written to the current database before the folder is allowed to change
		flushPendingTaskChanges();
		await waitForTaskStorageQueue();

		try {
			const result = await change(databaseLocationApi);
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

	const applyDatabaseDirectory = useCallback((directory: string): Promise<ApplyDatabaseDirectoryOutcome> => {
		return runDatabaseDirectoryChange((databaseLocationApi) => {
			return databaseLocationApi.setDatabaseDirectory(directory);
		});
	}, [ runDatabaseDirectoryChange ]);

	const applyDefaultDatabaseDirectory = useCallback((): Promise<ApplyDatabaseDirectoryOutcome> => {
		return runDatabaseDirectoryChange((databaseLocationApi) => {
			return databaseLocationApi.setDefaultDatabaseDirectory();
		});
	}, [ runDatabaseDirectoryChange ]);

	const contextValue = useMemo((): DatabaseLocationContextValue => {
		return {
			location,
			isLoading,
			loadErrorMessage,
			chooseDatabaseDirectory,
			applyDatabaseDirectory,
			applyDefaultDatabaseDirectory
		};
	}, [ location, isLoading, loadErrorMessage, chooseDatabaseDirectory, applyDatabaseDirectory, applyDefaultDatabaseDirectory ]);

	return (
		<DatabaseLocationContext.Provider value={contextValue}>
			{children}
		</DatabaseLocationContext.Provider>
	);
};
