import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { makeTask } from '../testUtils';
import { TasksPage } from 'src/components/tasks/TasksPage';
import type { Task, TaskChange } from 'src/types/TaskTypes';
import type { TaskFilterChange } from 'src/types/FilterTypes';
import type { LoadTasksResult, SpotStorageApi, StorageStatus, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

jest.mock('src/components/tasks/TaskFilters', () => {
	type MockTaskFiltersProps = {
		filters: {
			showCompleted: boolean;
		};
		onFilterChange: (changedFilters: TaskFilterChange) => void;
	};

	const MockTaskFilters = ({ filters, onFilterChange }: MockTaskFiltersProps): ReactElement => {
		const React = jest.requireActual('react') as typeof import('react');

		return React.createElement('div', {
			'data-testid': 'task-filters'
		}, [
			React.createElement('div', { key: 'status' }, `Show completed: ${String(filters.showCompleted)}`),
			React.createElement('button', {
				key: 'show-completed',
				type: 'button',
				onClick: () => {
					onFilterChange({ showCompleted: true });
				}
			}, 'Show completed')
		]);
	};

	return {
		TaskFilters: MockTaskFilters
	};
});

jest.mock('src/components/tasks/TasksList', () => {
	type MockTasksListProps = {
		title: string;
		tasks: Task[];
		onAddNewTask?: () => void;
		onUpdateTask: (oldTask: Task, changedValues: TaskChange) => void;
		onDeleteTask: (task: Task) => void;
		onMoveTask?: (fromIndex: number, toIndex: number) => void;
		onSortTasksByImportance?: () => void;
	};

	const MockTasksList = ({ title, tasks, onAddNewTask, onUpdateTask, onDeleteTask, onMoveTask, onSortTasksByImportance }: MockTasksListProps): ReactElement => {
		const React = jest.requireActual('react') as typeof import('react');
		const children = [
			React.createElement('h3', { key: 'title' }, title),
			...tasks.map((task) => {
				return React.createElement('div', { key: task.id }, task.text);
			})
		];

		if(onAddNewTask) {
			children.push(React.createElement('button', {
				key: 'add',
				type: 'button',
				onClick: onAddNewTask
			}, `${title} add`));
		}

		if(onSortTasksByImportance) {
			children.push(React.createElement('button', {
				key: 'sort',
				type: 'button',
				onClick: onSortTasksByImportance
			}, `${title} sort`));
		}

		if(onMoveTask && tasks.length > 1) {
			children.push(React.createElement('button', {
				key: 'move',
				type: 'button',
				onClick: () => {
					onMoveTask(0, 1);
				}
			}, `${title} move`));
		}

		if(tasks[0]) {
			children.push(React.createElement('button', {
				key: 'update',
				type: 'button',
				onClick: () => {
					onUpdateTask(tasks[0], { text: 'Updated by mock' });
				}
			}, `${title} update`));
			const stateToggleLabel = tasks[0].state === 'ACTIVE' ? `${title} complete` : `${title} restore`;
			const nextState = tasks[0].state === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';

			children.push(React.createElement('button', {
				key: 'complete',
				type: 'button',
				onClick: () => {
					onUpdateTask(tasks[0], { state: nextState });
				}
			}, stateToggleLabel));
			children.push(React.createElement('button', {
				key: 'delete',
				type: 'button',
				onClick: () => {
					onDeleteTask(tasks[0]);
				}
			}, `${title} delete`));
		}

		return React.createElement('section', {
			'aria-label': title
		}, children);
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

const createSuccessfulCommandResult = (): TaskStorageCommandResult => {
	return {
		ok: true,
		status: healthyStatus
	};
};

const createMockSpotStorage = (
	loadTasks: SpotStorageApi['loadTasks'],
	executeTaskCommand: SpotStorageApi['executeTaskCommand'] = jest.fn(async(): Promise<TaskStorageCommandResult> => {
		return createSuccessfulCommandResult();
	})
): SpotStorageApi => {
	return {
		loadTasks,
		executeTaskCommand,
		getStorageStatus: jest.fn(async() => {
			return healthyStatus;
		})
	};
};

const createLoadTasks = (tasks: Task[]): jest.Mock<Promise<LoadTasksResult>, []> => {
	return jest.fn(async(): Promise<LoadTasksResult> => {
		return {
			ok: true,
			tasks,
			status: healthyStatus
		};
	});
};

describe('TasksPage', () => {
	afterEach(() => {
		setWindowSpotStorage(originalSpotStorage);
		jest.restoreAllMocks();
		jest.useRealTimers();
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

	test('persists created, updated, completed, and deleted tasks through storage commands', async() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-06-20T10:00:00.000Z'));
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		const executeTaskCommand = jest.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return createSuccessfulCommandResult();
		});
		const spotStorage = createMockSpotStorage(createLoadTasks([ persistedTask ]), executeTaskCommand);
		setWindowSpotStorage(spotStorage);

		render(<TasksPage/>);
		expect(await screen.findByText('Persisted startup task')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Tasks update' }));
		expect(screen.getByText('Updated by mock')).toBeInTheDocument();
		expect(executeTaskCommand).toHaveBeenLastCalledWith({
			command: 'task.update',
			payload: {
				taskId: 'persisted-task',
				change: {
					text: 'Updated by mock'
				}
			}
		});

		fireEvent.click(screen.getByRole('button', { name: 'Tasks complete' }));
		expect(executeTaskCommand).toHaveBeenLastCalledWith({
			command: 'task.update',
			payload: {
				taskId: 'persisted-task',
				change: {
					state: 'COMPLETED',
					completionDate: expect.any(Date)
				}
			}
		});

		fireEvent.click(screen.getByRole('button', { name: 'Tasks add' }));
		const createCommand = executeTaskCommand.mock.calls.at(-1)![0] as TaskStorageCommand;
		expect(createCommand).toMatchObject({
			command: 'task.create',
			payload: {
				task: {
					text: '',
					state: 'ACTIVE',
					priority: 'HIGH',
					owner: undefined,
					dueDate: undefined,
					tags: [],
					sortPosition: 0,
					completionDate: undefined
				}
			}
		});
		expect(createCommand.command === 'task.create' && 'visible' in createCommand.payload.task).toBe(false);

		fireEvent.click(screen.getByRole('button', { name: 'Tasks delete' }));
		expect(executeTaskCommand).toHaveBeenLastCalledWith({
			command: 'task.delete',
			payload: {
				taskId: expect.any(String)
			}
		});
	});

	test('persists restored completed tasks through update commands', async() => {
		const completedTask = makeTask({
			id: 'completed-task',
			text: 'Completed task',
			state: 'COMPLETED',
			completionDate: new Date('2026-06-01T10:00:00.000Z'),
			sortPosition: 500,
			visible: false
		});
		const executeTaskCommand = jest.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return createSuccessfulCommandResult();
		});
		setWindowSpotStorage(createMockSpotStorage(createLoadTasks([ completedTask ]), executeTaskCommand));

		render(<TasksPage/>);
		expect(await screen.findByTestId('task-filters')).toHaveTextContent('Show completed: false');

		fireEvent.click(screen.getByRole('button', { name: 'Show completed' }));
		expect(screen.getByText('Completed task')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Completed Tasks restore' }));
		expect(executeTaskCommand).toHaveBeenLastCalledWith({
			command: 'task.update',
			payload: {
				taskId: 'completed-task',
				change: {
					state: 'ACTIVE',
					sortPosition: 0,
					completionDate: undefined
				}
			}
		});
	});

	test('persists manual reorder and importance sort through bulk update commands', async() => {
		const normalTask = makeTask({
			id: 'normal-task',
			text: 'Normal task',
			priority: 'NORMAL',
			sortPosition: 0,
			visible: false
		});
		const urgentTask = makeTask({
			id: 'urgent-task',
			text: 'Urgent task',
			priority: 'URGENT',
			sortPosition: 100,
			visible: false
		});
		const executeTaskCommand = jest.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return createSuccessfulCommandResult();
		});
		setWindowSpotStorage(createMockSpotStorage(createLoadTasks([ normalTask, urgentTask ]), executeTaskCommand));

		render(<TasksPage/>);
		expect(await screen.findByText('Normal task')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Tasks sort' }));
		expect(executeTaskCommand).toHaveBeenLastCalledWith({
			command: 'tasks.updateMany',
			payload: {
				reason: 'importance-sort',
				updates: [
					{
						taskId: 'normal-task',
						change: {
							sortPosition: 1100
						}
					}
				]
			}
		});

		fireEvent.click(screen.getByRole('button', { name: 'Tasks move' }));
		expect(executeTaskCommand).toHaveBeenLastCalledWith({
			command: 'tasks.updateMany',
			payload: {
				reason: 'manual-reorder',
				updates: [
					{
						taskId: 'urgent-task',
						change: {
							sortPosition: 2100
						}
					}
				]
			}
		});
	});

	test('shows a warning and reconciles local state when storage rejects a task command', async() => {
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		const loadTasks = jest.fn(async(): Promise<LoadTasksResult> => {
			return {
				ok: true,
				tasks: [ persistedTask ],
				status: healthyStatus
			};
		});
		const executeTaskCommand = jest.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return {
				ok: false,
				reason: 'database-error',
				message: 'Cannot update missing task.',
				status: {
					database: {
						state: 'unavailable',
						message: 'Cannot update missing task.'
					}
				}
			};
		});
		setWindowSpotStorage(createMockSpotStorage(loadTasks, executeTaskCommand));

		render(<TasksPage/>);
		expect(await screen.findByText('Persisted startup task')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Tasks update' }));
		expect(screen.getByText('Updated by mock')).toBeInTheDocument();

		const warning = await screen.findByRole('alert');
		expect(warning).toHaveTextContent('Task storage update failed. Cannot update missing task.');
		expect(screen.getByText('Persisted startup task')).toBeInTheDocument();
		expect(screen.queryByText('Updated by mock')).not.toBeInTheDocument();
		expect(loadTasks).toHaveBeenCalledTimes(2);
	});
});
