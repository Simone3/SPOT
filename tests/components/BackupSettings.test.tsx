import { act, fireEvent, render, screen } from '@testing-library/react';
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
	isDevelopment: false
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
		getBackupLocation: jest.fn(async() => {
			return backupLocation;
		}),
		chooseBackupDirectory: jest.fn(async() => {
			return {
				ok: true as const,
				directory: '/tmp/spot-new-backups'
			};
		}),
		setBackupDirectory: jest.fn(async() => {
			return {
				ok: true as const,
				location: {
					...backupLocation,
					directory: '/tmp/spot-new-backups'
				}
			};
		}),
		setDefaultBackupDirectory: jest.fn(async() => {
			return {
				ok: true as const,
				location: {
					...backupLocation,
					directory: backupLocation.defaultDirectory
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
		getStorageStatus: jest.fn(async() => {
			return status;
		}),
		onBackupStatusChanged: jest.fn(() => {
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
		jest.restoreAllMocks();
	});

	// The whole point of the settings panel is telling the user where the tasks really are
	test('shows the fixed database location next to the backup folder', async() => {
		setWindowApi('spotBackupLocation', createMockBackupLocationApi());
		setWindowApi('spotStorage', createMockStorageApi({
			state: 'ok',
			directory: backupLocation.directory,
			lastBackupAt: '2026-06-06T10:00:00.000Z'
		}));

		render(
			<BackupLocationContextProvider>
				<BackupSettings/>
			</BackupLocationContextProvider>
		);

		expect(await screen.findByText(backupLocation.databasePath)).toBeInTheDocument();
		expect(screen.getByText(backupLocation.directory)).toBeInTheDocument();
		expect(screen.getByText(/it does not keep two computers in sync/)).toBeInTheDocument();
	});

	test('reports a failed backup without claiming the tasks are lost', async() => {
		setWindowApi('spotBackupLocation', createMockBackupLocationApi());
		setWindowApi('spotStorage', createMockStorageApi({
			state: 'failed',
			directory: backupLocation.directory,
			message: 'The backup folder is not available.'
		}));

		render(
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

		render(
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
});
