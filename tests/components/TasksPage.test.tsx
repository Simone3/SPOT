import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { makeTask } from '../testUtils';
import { TasksPage } from 'src/components/tasks/TasksPage';
import type { LoadTasksResult, SpotStorageApi, StorageStatus, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

jest.mock('src/components/tasks/TaskFilters', () => {
	type MockTaskFiltersProps = {
		filters: {
			showCompleted: boolean;
		};
	};

	const MockTaskFilters = ({ filters }: MockTaskFiltersProps): ReactElement => {
		const React = jest.requireActual('react') as typeof import('react');

		return React.createElement('div', {
			'data-testid': 'task-filters'
		}, `Show completed: ${String(filters.showCompleted)}`);
	};

	return {
		TaskFilters: MockTaskFilters
	};
});

jest.mock('src/components/tasks/TasksList', () => {
	type MockTask = {
		id: string;
		text: string;
	};

	type MockTasksListProps = {
		title: string;
		tasks: MockTask[];
	};

	const MockTasksList = ({ title, tasks }: MockTasksListProps): ReactElement => {
		const React = jest.requireActual('react') as typeof import('react');

		return React.createElement('section', {
			'aria-label': title
		}, [
			React.createElement('h3', { key: 'title' }, title),
			...tasks.map((task) => {
				return React.createElement('div', { key: task.id }, task.text);
			})
		]);
	};

	return {
		TasksList: MockTasksList
	};
});

const healthyStatus: StorageStatus = {
	database: {
		state: 'healthy'
	},
	storageDirectory: '/tmp/spot-storage',
	databasePath: '/tmp/spot-storage/spot.sqlite'
};

const originalSpotStorage = window.spotStorage;

const setWindowSpotStorage = (spotStorage: SpotStorageApi | undefined): void => {
	Object.defineProperty(window, 'spotStorage', {
		configurable: true,
		writable: true,
		value: spotStorage
	});
};

const createMockSpotStorage = (loadTasks: SpotStorageApi['loadTasks']): SpotStorageApi => {
	return {
		loadTasks,
		executeTaskCommand: jest.fn(async(): Promise<TaskStorageCommandResult> => {
			const result: TaskStorageCommandResult = {
				ok: true,
				status: healthyStatus
			};

			return result;
		}),
		getStorageStatus: jest.fn(async() => {
			return healthyStatus;
		})
	};
};

describe('TasksPage', () => {
	afterEach(() => {
		setWindowSpotStorage(originalSpotStorage);
		jest.restoreAllMocks();
	});

	test('uses sample tasks when the Electron storage API is unavailable', async() => {
		setWindowSpotStorage(undefined);

		render(<TasksPage/>);

		expect(await screen.findByText(/Finish project report/)).toBeInTheDocument();
		expect(screen.getByTestId('task-filters')).toHaveTextContent('Show completed: false');
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	test('loads persisted tasks from Electron storage on startup', async() => {
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		let resolveLoadTasks: (result: LoadTasksResult) => void = () => {};
		let loadTasksPromise: Promise<LoadTasksResult> | undefined;
		const loadTasks = jest.fn(() => {
			loadTasksPromise = new Promise((resolve) => {
				resolveLoadTasks = resolve;
			});

			return loadTasksPromise;
		});
		setWindowSpotStorage(createMockSpotStorage(loadTasks));

		render(<TasksPage/>);

		expect(screen.getByRole('status')).toHaveTextContent('Loading tasks...');
		expect(loadTasks).toHaveBeenCalledTimes(1);

		await act(async() => {
			resolveLoadTasks({
				ok: true,
				tasks: [ persistedTask ],
				status: healthyStatus
			});
			await loadTasksPromise;
		});

		expect(screen.getByRole('region', { name: 'Tasks' })).toBeInTheDocument();
		expect(screen.getByText('Persisted startup task')).toBeInTheDocument();
		expect(screen.queryByText(/Finish project report/)).not.toBeInTheDocument();
	});

	test('shows a startup error when Electron storage loading fails', async() => {
		const loadTasks = jest.fn(async(): Promise<LoadTasksResult> => {
			return {
				ok: false,
				reason: 'database-error',
				message: 'Could not open spot.sqlite.',
				status: {
					database: {
						state: 'unavailable',
						message: 'Could not open spot.sqlite.'
					},
					storageDirectory: '/tmp/spot-storage',
					databasePath: '/tmp/spot-storage/spot.sqlite'
				}
			};
		});
		setWindowSpotStorage(createMockSpotStorage(loadTasks));

		render(<TasksPage/>);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Task storage is unavailable');
		expect(alert).toHaveTextContent('Could not open spot.sqlite.');
		expect(screen.queryByRole('region', { name: 'Tasks' })).not.toBeInTheDocument();
	});
});
