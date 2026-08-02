import { act, fireEvent, render, screen } from '@testing-library/react';
import { DatabaseLocationGate } from 'src/components/storage/DatabaseLocationGate';
import { DatabaseLocationSettings } from 'src/components/storage/DatabaseLocationSettings';
import { DatabaseLocationContextProvider } from 'src/contexts/DatabaseLocationContext';
import type { DatabaseLocation, SpotDatabaseLocationApi } from 'src/types/DatabaseLocationTypes';

const originalDatabaseLocationApi = window.spotDatabaseLocation;

const unconfiguredLocation: DatabaseLocation = {
	state: 'unconfigured',
	defaultDirectory: '/tmp/spot-user-data/storage',
	isDevelopment: false
};

const configuredLocation: DatabaseLocation = {
	state: 'configured',
	directory: '/tmp/spot-tasks',
	defaultDirectory: '/tmp/spot-user-data/storage',
	isDevelopment: false
};

const setWindowDatabaseLocationApi = (databaseLocationApi: SpotDatabaseLocationApi | undefined): void => {
	Object.defineProperty(window, 'spotDatabaseLocation', {
		configurable: true,
		writable: true,
		value: databaseLocationApi
	});
};

const createMockDatabaseLocationApi = (
	location: DatabaseLocation,
	overrides: Partial<SpotDatabaseLocationApi> = {}
): SpotDatabaseLocationApi => {
	return {
		getDatabaseLocation: jest.fn(async() => {
			return location;
		}),
		chooseDatabaseDirectory: jest.fn(async() => {
			return {
				ok: true as const,
				directory: '/tmp/spot-new-tasks',
				hasExistingDatabase: false
			};
		}),
		setDatabaseDirectory: jest.fn(async() => {
			return {
				ok: true as const,
				location: {
					...configuredLocation,
					directory: '/tmp/spot-new-tasks'
				}
			};
		}),
		setDefaultDatabaseDirectory: jest.fn(async() => {
			return {
				ok: true as const,
				location: {
					...configuredLocation,
					directory: configuredLocation.defaultDirectory
				}
			};
		}),
		...overrides
	};
};

const clickAndSettle = async(element: HTMLElement): Promise<void> => {
	await act(async() => {
		fireEvent.click(element);
	});
};

describe('DatabaseLocation', () => {
	afterEach(() => {
		setWindowDatabaseLocationApi(originalDatabaseLocationApi);
		jest.restoreAllMocks();
	});

	test('blocks the app until a task database folder is chosen on the first startup', async() => {
		const databaseLocationApi = createMockDatabaseLocationApi(unconfiguredLocation);
		setWindowDatabaseLocationApi(databaseLocationApi);

		render(
			<DatabaseLocationContextProvider>
				<DatabaseLocationGate>
					<div>Task page</div>
				</DatabaseLocationGate>
			</DatabaseLocationContextProvider>
		);

		expect(await screen.findByText('Choose where SPOT stores your tasks')).toBeInTheDocument();
		expect(screen.queryByText('Task page')).not.toBeInTheDocument();

		await clickAndSettle(screen.getByRole('button', { name: 'Choose folder...' }));

		expect(databaseLocationApi.chooseDatabaseDirectory).toHaveBeenCalledTimes(1);
		expect(databaseLocationApi.setDatabaseDirectory).toHaveBeenCalledWith('/tmp/spot-new-tasks');
		expect(await screen.findByText('Task page')).toBeInTheDocument();
	});

	test('changes the task database folder from the settings page after a confirmation', async() => {
		const databaseLocationApi = createMockDatabaseLocationApi(configuredLocation);
		setWindowDatabaseLocationApi(databaseLocationApi);

		render(
			<DatabaseLocationContextProvider>
				<DatabaseLocationSettings/>
			</DatabaseLocationContextProvider>
		);

		expect(await screen.findByText(configuredLocation.directory!)).toBeInTheDocument();

		await clickAndSettle(screen.getByRole('button', { name: 'Change folder...' }));

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('New folder: /tmp/spot-new-tasks')).toBeInTheDocument();
		expect(databaseLocationApi.setDatabaseDirectory).not.toHaveBeenCalled();

		await clickAndSettle(screen.getByRole('button', { name: 'Change folder' }));

		expect(databaseLocationApi.setDatabaseDirectory).toHaveBeenCalledWith('/tmp/spot-new-tasks');
		expect(await screen.findByText('Tasks are now stored in "/tmp/spot-new-tasks".')).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});
});
