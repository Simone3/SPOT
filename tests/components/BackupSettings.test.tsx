import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithTranslations } from '../testUtils';
import { BackupSettings } from 'src/components/storage/BackupSettings';
import { BackupLocationContextProvider } from 'src/contexts/BackupLocationContext';
import type { BackupLocation, SpotBackupLocationApi } from 'src/types/BackupLocationTypes';
import type { BackupStatus, SpotStorageApi, StorageStatus } from 'src/types/TaskStorageTypes';

const originalBackupLocationApi = window.spotBackupLocation;
const originalStorageApi = window.spotStorage;

const backupLocation: BackupLocation = {
	directory: '/tmp/spot-backups',
	defaultDirectory: '/tmp/spot-user-data/backups',
	databaseDirectory: '/tmp/spot-user-data/storage',
	databasePath: '/tmp/spot-user-data/storage/spot.sqlite',
	isDevelopment: false,
	retainedBackupCount: 10
};

const setWindowApi = (name: 'spotBackupLocation' | 'spotStorage', value: unknown): void => {
	Object.defineProperty(window, name, {
		configurable: true,
		writable: true,
		value
	});
};

const createMockBackupLocationApi = (
	overrides: Partial<SpotBackupLocationApi> = {}
): SpotBackupLocationApi => {
	return {
		getBackupLocation: vi.fn(async() => {
			return backupLocation;
		}),
		chooseBackupDirectory: vi.fn(async() => {
			return {
				ok: true as const,
				directory: '/tmp/spot-new-backups'
			};
		}),
		setBackupDirectory: vi.fn(async() => {
			return {
				ok: true as const,
				location: {
					...backupLocation,
					directory: '/tmp/spot-new-backups'
				}
			};
		}),
		setDefaultBackupDirectory: vi.fn(async() => {
			return {
				ok: true as const,
				location: {
					...backupLocation,
					directory: backupLocation.defaultDirectory
				}
			};
		}),
		setRetainedBackupCount: vi.fn(async(retainedBackupCount: number) => {
			return {
				ok: true as const,
				location: {
					...backupLocation,
					retainedBackupCount
				}
			};
		}),
		...overrides
	};
};

const createMockStorageApi = (backup: BackupStatus | undefined): Pick<SpotStorageApi, 'getStorageStatus' | 'onBackupStatusChanged'> => {
	const status: StorageStatus = {
		database: { state: 'healthy' },
		backup
	};

	return {
		getStorageStatus: vi.fn(async() => {
			return status;
		}),
		onBackupStatusChanged: vi.fn(() => {
			return () => {
				return undefined;
			};
		})
	};
};

const clickAndSettle = async(element: HTMLElement): Promise<void> => {
	await act(async() => {
		fireEvent.click(element);
	});
};

describe('BackupSettings', () => {
	afterEach(() => {
		setWindowApi('spotBackupLocation', originalBackupLocationApi);
		setWindowApi('spotStorage', originalStorageApi);
		vi.restoreAllMocks();
	});

	// The whole point of the settings panel is telling the user where the tasks really are
	test('shows the fixed database location next to the backup folder', async() => {
		setWindowApi('spotBackupLocation', createMockBackupLocationApi());
		setWindowApi('spotStorage', createMockStorageApi({
			state: 'ok',
			directory: backupLocation.directory,
			latestCopyAt: '2026-06-06T10:00:00.000Z'
		}));

		renderWithTranslations(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		expect(await screen.findByText(backupLocation.databasePath)).toBeInTheDocument();
		expect(screen.getByText(backupLocation.directory)).toBeInTheDocument();
		expect(screen.getByText(/it does not keep two computers in sync/)).toBeInTheDocument();
	});

	// Backups nobody knows how to use are not backups, and SPOT never reads one back on its own
	test('says how to restore a backup copy, in the notice about the folder', async() => {
		setWindowApi('spotBackupLocation', createMockBackupLocationApi());
		setWindowApi('spotStorage', createMockStorageApi(undefined));

		renderWithTranslations(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		const notice = await screen.findByText(/it does not keep two computers in sync/);

		expect(notice).toHaveTextContent('close SPOT and copy the copy you want over the database above');
		expect(notice).toHaveTextContent('replaces every change made after that copy was written');
	});

	test('reports a failed backup without claiming the tasks are lost', async() => {
		setWindowApi('spotBackupLocation', createMockBackupLocationApi());
		setWindowApi('spotStorage', createMockStorageApi({
			state: 'failed',
			directory: backupLocation.directory,
			message: 'The backup folder is not available.'
		}));

		renderWithTranslations(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		expect(await screen.findByRole('alert')).toHaveTextContent('Your tasks are still saved. The backup folder is not available.');
	});

	test('changes the backup folder after a confirmation', async() => {
		const backupLocationApi = createMockBackupLocationApi();
		setWindowApi('spotBackupLocation', backupLocationApi);
		setWindowApi('spotStorage', createMockStorageApi(undefined));

		renderWithTranslations(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		expect(await screen.findByText(backupLocation.directory)).toBeInTheDocument();

		await clickAndSettle(screen.getByRole('button', { name: 'Change folder...' }));

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('New folder: /tmp/spot-new-backups')).toBeInTheDocument();
		expect(backupLocationApi.setBackupDirectory).not.toHaveBeenCalled();

		await clickAndSettle(screen.getByRole('button', { name: 'Change folder' }));

		expect(backupLocationApi.setBackupDirectory).toHaveBeenCalledWith('/tmp/spot-new-backups');
		expect(await screen.findByText('Backup copies are now written to "/tmp/spot-new-backups".')).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	// The two kinds of copy answer two different questions, so a folder that is up to date but has not reached back in days says so
	test('reports the up-to-date copy and the newest dated one separately', async() => {
		setWindowApi('spotBackupLocation', createMockBackupLocationApi());
		setWindowApi('spotStorage', createMockStorageApi({
			state: 'ok',
			directory: backupLocation.directory,
			latestCopyAt: '2026-06-06T10:00:00.000Z',
			lastArchiveAt: '2026-06-04T08:00:00.000Z'
		}));

		renderWithTranslations(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		expect(await screen.findByText(/The up-to-date copy was written on/)).toBeInTheDocument();
		expect(screen.getByText(/The most recent dated copy was written on/)).toBeInTheDocument();
	});

	// A bare number says nothing about what it gets the user, and the two kinds of copy are what it is actually spent on
	test('says what the chosen number of copies means', async() => {
		setWindowApi('spotBackupLocation', createMockBackupLocationApi());
		setWindowApi('spotStorage', createMockStorageApi(undefined));

		renderWithTranslations(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		expect(await screen.findByText(/the 9 most recent dated copies are kept beside it/)).toBeInTheDocument();
		expect(screen.getByLabelText('Number of copies')).toHaveValue(10);
	});

	test('changes how many copies are kept', async() => {
		const backupLocationApi = createMockBackupLocationApi();
		setWindowApi('spotBackupLocation', backupLocationApi);
		setWindowApi('spotStorage', createMockStorageApi(undefined));

		renderWithTranslations(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		// The field is only usable once the settings have arrived from the main process
		await screen.findByText(/the 9 most recent dated copies are kept beside it/);

		const countField = screen.getByLabelText('Number of copies');

		await act(async() => {
			fireEvent.change(countField, { target: { value: '4' } });
			fireEvent.blur(countField);
		});

		expect(backupLocationApi.setRetainedBackupCount).toHaveBeenCalledWith(4);
		expect(await screen.findByText('SPOT now keeps 4 backup copies.')).toBeInTheDocument();
	});

	// Keeping none is a real choice, and the panel has to say that the tasks themselves are not the thing being given up
	test('says that no copies at all are written when none are kept', async() => {
		setWindowApi('spotBackupLocation', createMockBackupLocationApi({
			getBackupLocation: vi.fn(async() => {
				return {
					...backupLocation,
					retainedBackupCount: 0
				};
			})
		}));
		setWindowApi('spotStorage', createMockStorageApi(undefined));

		renderWithTranslations(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		expect(await screen.findByText(/No backup copies are written at all/)).toBeInTheDocument();
	});
});
