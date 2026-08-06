import type { Mock } from 'vitest';
import { act, fireEvent, screen, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { makeTask, renderWithTranslations } from '../testUtils';
import { AUDIT_CONFIG } from 'src/config/AppConfig';
import { flushPendingTaskChanges, resetPendingTaskChangesForTests } from 'src/logic/PendingTaskChanges';
import { resetTaskStorageQueueForTests, waitForTaskStorageQueue } from 'src/logic/TaskStorageQueue';
import { TasksContextProvider } from 'src/contexts/TasksContext';
import { TasksPage } from 'src/components/tasks/TasksPage';
import type { Task, TaskChange } from 'src/types/TaskTypes';
import type { TaskFilterChange } from 'src/types/FilterTypes';
import type { LoadTasksResult, SpotStorageApi, StorageStatus, TaskStorageCommand, TaskStorageCommandResult } from 'src/types/TaskStorageTypes';

vi.mock('src/components/tasks/TaskFilters', async() => {
	// The mock factory is hoisted above the imports, so the real modules it needs are loaded here rather than referenced from the module scope
	const React = await vi.importActual<typeof import('react')>('react');

	type MockTaskFiltersProps = {
		filters: {
			showCompleted: boolean;
		};
		onFilterChange: (changedFilters: TaskFilterChange) => void;
	};

	const MockTaskFilters = ({ filters, onFilterChange }: MockTaskFiltersProps): ReactElement => {
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

vi.mock('src/components/tasks/TasksList', async() => {
	// The mock factory is hoisted above the imports, so the real modules it needs are loaded here rather than referenced from the module scope
	const React = await vi.importActual<typeof import('react')>('react');
	const { changePendingTaskValue, flushPendingTaskChangesForTask } = await vi.importActual<typeof import('src/logic/PendingTaskChanges')>('src/logic/PendingTaskChanges');

	type MockTasksListProps = {
		title: string;
		tasks: Task[];
		onAddNewTask?: () => void;
		onDeleteTask: (task: Task) => void;
		onMoveTask?: (fromIndex: number, toIndex: number) => void;
		onSortTasksByImportance?: () => void;
	};

	// Task components buffer their changes outside the component tree, so the mocked list edits tasks the same way
	const onUpdateTask = (task: Task, changedValues: TaskChange): void => {
		Object.entries(changedValues).forEach(([ key, value ]) => {
			changePendingTaskValue(task, key as keyof Task, value as Task[keyof Task], 'buffered');
		});
		flushPendingTaskChangesForTask(task.id);
	};

	const MockTasksList = ({ title, tasks, onAddNewTask, onDeleteTask, onMoveTask, onSortTasksByImportance }: MockTasksListProps): ReactElement => {
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
				key: 'tag',
				type: 'button',
				onClick: () => {
					// The trailing tag input is an empty tag in the task tags until the user types the next tag into it
					onUpdateTask(tasks[0], { tags: [ 'urgent', '' ] });
				}
			}, `${title} tag`));
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
	executeTaskCommand: SpotStorageApi['executeTaskCommand'] = vi.fn(async(): Promise<TaskStorageCommandResult> => {
		return createSuccessfulCommandResult();
	})
): SpotStorageApi => {
	return {
		loadTasks,
		executeTaskCommand,
		getStorageStatus: vi.fn(async() => {
			return healthyStatus;
		}),
		onFlushPendingTaskChanges: vi.fn(() => {
			return () => {};
		}),
		onBackupStatusChanged: vi.fn(() => {
			return () => {};
		}),
		notifyPendingTaskChangesFlushed: vi.fn(async() => {
			return undefined;
		})
	};
};

const createLoadTasks = (tasks: Task[]): Mock<() => Promise<LoadTasksResult>> => {
	return vi.fn(async(): Promise<LoadTasksResult> => {
		return {
			ok: true,
			tasks,
			status: healthyStatus
		};
	});
};

// The task state lives in the provider, so the page is always rendered inside it, exactly as the application shell does
const renderTasksPage = (): RenderResult => {
	return renderWithTranslations(
		<TasksContextProvider>
			<TasksPage/>
		</TasksContextProvider>
	);
};

// Moving to another page unmounts TasksPage while the provider above the router stays mounted
type NavigableAppProps = {
	isOnTasksPage: boolean;
};

const NavigableApp = ({ isOnTasksPage }: NavigableAppProps): ReactElement => {
	return (
		<TasksContextProvider>
			{isOnTasksPage ? <TasksPage/> : <div>Settings page</div>}
		</TasksContextProvider>
	);
};

const clickAndSettle = async(element: HTMLElement): Promise<void> => {
	await act(async() => {
		fireEvent.click(element);
	});
};

const createDeferred = <T,>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve: (value: T) => void = () => {};
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve;
	});

	return {
		promise,
		resolve
	};
};

describe('TasksPage', () => {
	afterEach(() => {
		setWindowSpotStorage(originalSpotStorage);
		resetPendingTaskChangesForTests();
		resetTaskStorageQueueForTests();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	test('requires the Electron storage API on startup', async() => {
		setWindowSpotStorage(undefined);

		renderTasksPage();

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Task storage is unavailable');
		expect(alert).toHaveTextContent('SPOT must be opened from the Electron app.');
		expect(screen.queryByRole('region', { name: 'Tasks' })).not.toBeInTheDocument();
	});

	test('loads persisted tasks from Electron storage on startup', async() => {
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		let resolveLoadTasks: (result: LoadTasksResult) => void = () => {};
		let loadTasksPromise: Promise<LoadTasksResult> | undefined;
		const loadTasks = vi.fn(() => {
			loadTasksPromise = new Promise((resolve) => {
				resolveLoadTasks = resolve;
			});

			return loadTasksPromise;
		});
		setWindowSpotStorage(createMockSpotStorage(loadTasks));

		renderTasksPage();

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
		expect(screen.queryByText('Task storage needs attention')).not.toBeInTheDocument();
	});

	test('shows a startup error when Electron storage loading fails', async() => {
		const loadTasks = vi.fn(async(): Promise<LoadTasksResult> => {
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

		renderTasksPage();

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Task storage is unavailable');
		expect(alert).toHaveTextContent('Could not open spot.sqlite.');
		expect(screen.queryByRole('region', { name: 'Tasks' })).not.toBeInTheDocument();
	});

	test('persists created, updated, completed, and deleted tasks through storage commands', async() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-20T10:00:00.000Z'));
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		const executeTaskCommand = vi.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return createSuccessfulCommandResult();
		});
		const spotStorage = createMockSpotStorage(createLoadTasks([ persistedTask ]), executeTaskCommand);
		setWindowSpotStorage(spotStorage);

		renderTasksPage();
		expect(await screen.findByText('Persisted startup task')).toBeInTheDocument();

		await clickAndSettle(screen.getByRole('button', { name: 'Tasks update' }));
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

		await clickAndSettle(screen.getByRole('button', { name: 'Tasks complete' }));
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

		await clickAndSettle(screen.getByRole('button', { name: 'Tasks add' }));
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

		await clickAndSettle(screen.getByRole('button', { name: 'Tasks delete' }));
		expect(executeTaskCommand).toHaveBeenLastCalledWith({
			command: 'task.delete',
			payload: {
				taskId: expect.any(String)
			}
		});
	});

	test('never persists the empty tag of a tag input', async() => {
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			tags: [ 'urgent' ],
			visible: false
		});
		const executeTaskCommand = vi.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return createSuccessfulCommandResult();
		});
		setWindowSpotStorage(createMockSpotStorage(createLoadTasks([ persistedTask ]), executeTaskCommand));

		renderTasksPage();
		expect(await screen.findByText('Persisted startup task')).toBeInTheDocument();

		// The task already holds the only real tag, so the empty one it is saved with is not a change at all
		await clickAndSettle(screen.getByRole('button', { name: 'Tasks tag' }));

		expect(executeTaskCommand).not.toHaveBeenCalled();
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
		const executeTaskCommand = vi.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return createSuccessfulCommandResult();
		});
		setWindowSpotStorage(createMockSpotStorage(createLoadTasks([ completedTask ]), executeTaskCommand));

		renderTasksPage();
		expect(await screen.findByTestId('task-filters')).toHaveTextContent('Show completed: false');

		await clickAndSettle(screen.getByRole('button', { name: 'Show completed' }));
		expect(screen.getByText('Completed task')).toBeInTheDocument();

		await clickAndSettle(screen.getByRole('button', { name: 'Completed Tasks restore' }));
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
		const executeTaskCommand = vi.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return createSuccessfulCommandResult();
		});
		setWindowSpotStorage(createMockSpotStorage(createLoadTasks([ normalTask, urgentTask ]), executeTaskCommand));

		renderTasksPage();
		expect(await screen.findByText('Normal task')).toBeInTheDocument();

		await clickAndSettle(screen.getByRole('button', { name: 'Tasks sort' }));
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

		await clickAndSettle(screen.getByRole('button', { name: 'Tasks move' }));
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

	test('makes the shutdown flush wait for the storage commands it dispatched', async() => {
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		const commandDeferred = createDeferred<TaskStorageCommandResult>();
		const executeTaskCommand = vi.fn((command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return commandDeferred.promise;
		});
		setWindowSpotStorage(createMockSpotStorage(createLoadTasks([ persistedTask ]), executeTaskCommand));

		renderTasksPage();
		expect(await screen.findByText('Persisted startup task')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Tasks update' }));

		let didWaitSettle = false;
		flushPendingTaskChanges();
		const waitPromise = waitForTaskStorageQueue().then(() => {
			didWaitSettle = true;
		});

		await act(async() => {
			await Promise.resolve();
		});

		expect(didWaitSettle).toBe(false);

		await act(async() => {
			commandDeferred.resolve(createSuccessfulCommandResult());
			await waitPromise;
		});

		expect(didWaitSettle).toBe(true);
	});

	test('warns but keeps what the user changed when storage rejects a task command', async() => {
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		const loadTasks = createLoadTasks([ persistedTask ]);
		const commandFailure: TaskStorageCommandResult = {
			ok: false,
			reason: 'database-error',
			message: 'Cannot write task changes.',
			status: {
				database: {
					state: 'unavailable',
					message: 'Cannot write task changes.'
				}
			}
		};
		const commandDeferred = createDeferred<TaskStorageCommandResult>();
		const executeTaskCommand = vi.fn((command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return commandDeferred.promise;
		});
		setWindowSpotStorage(createMockSpotStorage(loadTasks, executeTaskCommand));

		renderTasksPage();
		expect(await screen.findByText('Persisted startup task')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Tasks update' }));
		expect(screen.getByText('Updated by mock')).toBeInTheDocument();

		await act(async() => {
			commandDeferred.resolve(commandFailure);
			await commandDeferred.promise;
		});

		const warning = await screen.findByRole('alert');
		expect(warning).toHaveTextContent('Task storage update failed. Cannot write task changes.');

		// The change the user made stays on screen and the database is not read back over it
		expect(screen.getByText('Updated by mock')).toBeInTheDocument();
		expect(screen.queryByText('Persisted startup task')).not.toBeInTheDocument();
		expect(loadTasks).toHaveBeenCalledTimes(1);
	});

	test('shows database health when storage remains unavailable after a write failure', async() => {
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		const unavailableStatus: StorageStatus = {
			database: {
				state: 'unavailable',
				message: 'Could not reopen spot.sqlite.'
			},
			storageDirectory: '/tmp/spot-storage',
			databasePath: '/tmp/spot-storage/spot.sqlite'
		};
		const loadTasks = createLoadTasks([ persistedTask ]);
		const commandFailure: TaskStorageCommandResult = {
			ok: false,
			reason: 'database-error',
			message: 'Cannot write task changes.',
			status: unavailableStatus
		};
		const commandDeferred = createDeferred<TaskStorageCommandResult>();
		const executeTaskCommand = vi.fn((command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return commandDeferred.promise;
		});
		setWindowSpotStorage(createMockSpotStorage(loadTasks, executeTaskCommand));

		renderTasksPage();
		expect(await screen.findByText('Persisted startup task')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Tasks update' }));
		expect(screen.getByText('Updated by mock')).toBeInTheDocument();

		await act(async() => {
			commandDeferred.resolve(commandFailure);
			await commandDeferred.promise;
		});

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Tasks are not saved');
		expect(alert).toHaveTextContent('Task storage update failed. Cannot write task changes.');
		expect(alert).toHaveTextContent('Database status: unavailable. Could not reopen spot.sqlite.');
		expect(screen.getByText('Updated by mock')).toBeInTheDocument();
	});

	test('keeps the loaded tasks and the filters when the user leaves the page and comes back', async() => {
		const persistedTask = makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task',
			visible: false
		});
		const loadTasks = createLoadTasks([ persistedTask ]);
		const executeTaskCommand = vi.fn(async(command: TaskStorageCommand): Promise<TaskStorageCommandResult> => {
			void command;
			return createSuccessfulCommandResult();
		});
		setWindowSpotStorage(createMockSpotStorage(loadTasks, executeTaskCommand));

		const { rerender } = renderWithTranslations(<NavigableApp isOnTasksPage={true}/>);
		expect(await screen.findByText('Persisted startup task')).toBeInTheDocument();

		await clickAndSettle(screen.getByRole('button', { name: 'Show completed' }));
		await clickAndSettle(screen.getByRole('button', { name: 'Tasks update' }));
		expect(screen.getByText('Updated by mock')).toBeInTheDocument();

		await act(async() => {
			rerender(<NavigableApp isOnTasksPage={false}/>);
		});

		expect(screen.getByText('Settings page')).toBeInTheDocument();

		await act(async() => {
			rerender(<NavigableApp isOnTasksPage={true}/>);
		});

		// The page comes back on the state it left, without a loading step and without reading the database over the changes it holds
		expect(screen.queryByText('Loading tasks...')).not.toBeInTheDocument();
		expect(screen.getByTestId('task-filters')).toHaveTextContent('Show completed: true');
		expect(screen.getByText('Updated by mock')).toBeInTheDocument();
		expect(screen.queryByText('Persisted startup task')).not.toBeInTheDocument();
		expect(loadTasks).toHaveBeenCalledTimes(1);
	});

	test('audits the task state against the database and reports what the two do not agree on', async() => {
		const shownTask = makeTask({
			id: 'audited-task',
			text: 'Audited task'
		});
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const loadTasks: Mock<() => Promise<LoadTasksResult>> = vi.fn(async(): Promise<LoadTasksResult> => {
			return {
				ok: true,

				// The audit reads the database again, and this time it does not hold the task the renderer is showing
				tasks: loadTasks.mock.calls.length === 1 ? [ shownTask ] : [],
				status: healthyStatus
			};
		});
		setWindowSpotStorage(createMockSpotStorage(loadTasks));
		vi.useFakeTimers();

		renderTasksPage();
		await act(async() => {});

		expect(screen.getByText('Audited task')).toBeInTheDocument();

		await act(async() => {
			vi.advanceTimersByTime(AUDIT_CONFIG.initialDelayMs);
		});

		expect(loadTasks).toHaveBeenCalledTimes(2);

		const auditNotice = screen.getByRole('status');
		expect(auditNotice).toHaveTextContent('Tasks on screen and stored tasks differ');
		expect(auditNotice).toHaveTextContent('1 task not stored yet');

		// The message only says how much drifted, so the tasks and the fields it found are reported to the console
		expect(consoleWarn).toHaveBeenCalledTimes(1);
	});

	test('does not audit while a task change has not reached storage yet', async() => {
		const loadTasks = createLoadTasks([ makeTask({
			id: 'persisted-task',
			text: 'Persisted startup task'
		}) ]);
		const pendingWrite = createDeferred<TaskStorageCommandResult>();
		setWindowSpotStorage(createMockSpotStorage(loadTasks, vi.fn(() => {
			return pendingWrite.promise;
		})));
		vi.useFakeTimers();

		renderTasksPage();
		await act(async() => {});
		await clickAndSettle(screen.getByRole('button', { name: 'Tasks add' }));

		await act(async() => {
			vi.advanceTimersByTime(AUDIT_CONFIG.initialDelayMs);
		});

		// The task the user just added is still on its way to the database, so the task state being ahead of it is the write
		// path working as designed and never a drift to report
		expect(loadTasks).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('status')).not.toBeInTheDocument();

		pendingWrite.resolve(createSuccessfulCommandResult());
		await act(async() => {
			await waitForTaskStorageQueue();
		});
	});
});
