import 'src/components/tasks/TasksPage.css';
import { useState, useEffect, useRef, type ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { getInitialTaskState, addTaskToTaskState, refreshVisibleTasksInTaskState, deleteTaskFromTaskState, changeFiltersInTaskState, loadTasksIntoTaskState, resetFiltersTaskState, updateTaskInTaskState, sortTasksByImportanceInTaskState, moveActiveTaskInTaskState, type TaskStateContainer } from 'src/logic/TaskStateLogic';
import type { PersistedTask, PersistedTaskChange, Task, TaskChange, TasksContainer } from 'src/types/TaskTypes';
import type { TaskFilterChange } from 'src/types/FilterTypes';
import type { SpotStorageApi, StorageStatus, TaskStorageCommand } from 'src/types/TaskStorageTypes';
import { TasksList } from 'src/components/tasks/TasksList';
import { TaskFilters } from 'src/components/tasks/TaskFilters';

type TaskStartupState = {
	state: 'loading';
} | {
	state: 'loaded';
} | {
	state: 'startup-error';
	message: string;
};

interface TaskStorageFeedback {
	role: 'alert' | 'status';
	title: string;
	message: string;
	statusMessage?: string;
}

const PERSISTED_TASK_FIELD_NAMES: readonly (keyof PersistedTaskChange)[] = [
	'text',
	'state',
	'priority',
	'owner',
	'dueDate',
	'tags',
	'sortPosition',
	'completionDate'
];

const ELECTRON_STORAGE_API_UNAVAILABLE_MESSAGE = 'SPOT must be opened from the Electron app.';

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
};

const cloneDate = (date: Date | undefined): Date | undefined => {
	return date ? new Date(date) : undefined;
};

const taskToPersistedTask = (task: Task): PersistedTask => {
	return {
		id: task.id,
		text: task.text,
		state: task.state,
		priority: task.priority,
		owner: task.owner,
		dueDate: task.dueDate,
		tags: [ ...task.tags ],
		sortPosition: task.sortPosition,
		completionDate: cloneDate(task.completionDate)
	};
};

const getPersistedTaskValue = (
	task: Task,
	fieldName: keyof PersistedTask
): PersistedTask[keyof PersistedTask] => {
	return taskToPersistedTask(task)[fieldName];
};

const arePersistedTaskValuesEqual = (
	previousValue: PersistedTask[keyof PersistedTask],
	nextValue: PersistedTask[keyof PersistedTask]
): boolean => {
	if(previousValue instanceof Date || nextValue instanceof Date) {
		return previousValue instanceof Date &&
			nextValue instanceof Date &&
			previousValue.getTime() === nextValue.getTime();
	}

	if(Array.isArray(previousValue) || Array.isArray(nextValue)) {
		return Array.isArray(previousValue) &&
			Array.isArray(nextValue) &&
			previousValue.length === nextValue.length &&
			previousValue.every((value, index) => {
				return value === nextValue[index];
			});
	}

	return previousValue === nextValue;
};

const setPersistedTaskChangeValue = (
	change: PersistedTaskChange,
	fieldName: keyof PersistedTaskChange,
	value: PersistedTask[keyof PersistedTask]
): void => {
	(change as Partial<Record<keyof PersistedTaskChange, PersistedTask[keyof PersistedTask]>>)[fieldName] = value;
};

const createPersistedTaskChange = (previousTask: Task, nextTask: Task): PersistedTaskChange => {
	const change: PersistedTaskChange = {};

	PERSISTED_TASK_FIELD_NAMES.forEach((fieldName) => {
		const previousValue = getPersistedTaskValue(previousTask, fieldName);
		const nextValue = getPersistedTaskValue(nextTask, fieldName);

		if(!arePersistedTaskValuesEqual(previousValue, nextValue)) {
			setPersistedTaskChangeValue(change, fieldName, nextValue);
		}
	});

	return change;
};

const hasPersistedTaskChange = (change: PersistedTaskChange): boolean => {
	return Object.keys(change).length > 0;
};

const createStorageStatusMessage = (storageStatus: StorageStatus): string | undefined => {
	if(storageStatus.database.state === 'healthy') {
		return undefined;
	}

	const databaseState = storageStatus.database.state === 'not-configured' ? 'not configured' : storageStatus.database.state;

	return storageStatus.database.message ?
		`Database status: ${databaseState}. ${storageStatus.database.message}` :
		`Database status: ${databaseState}.`;
};

const createTaskStorageFeedback = (
	taskStorageWarning: string | undefined,
	taskStorageStatus: StorageStatus | undefined
): TaskStorageFeedback | undefined => {
	const statusMessage = taskStorageStatus ? createStorageStatusMessage(taskStorageStatus) : undefined;

	if(taskStorageWarning) {
		return {
			role: 'alert',
			title: 'Tasks are not saved',
			message: taskStorageWarning,
			statusMessage
		};
	}

	if(statusMessage) {
		return {
			role: taskStorageStatus?.database.state === 'unavailable' ? 'alert' : 'status',
			title: 'Task storage needs attention',
			message: statusMessage
		};
	}

	return undefined;
};

const tryReadTaskStorageStatus = async(spotStorage: SpotStorageApi): Promise<StorageStatus | undefined> => {
	try {
		return await spotStorage.getStorageStatus();
	}
	catch {
		return undefined;
	}
};

const createSortPositionUpdates = (
	previousTasksContainer: TasksContainer,
	nextTasksContainer: TasksContainer
): { taskId: string; change: PersistedTaskChange }[] => {
	const previousSortPositions = new Map(previousTasksContainer.active.map((task) => {
		return [ task.id, task.sortPosition ];
	}));

	return nextTasksContainer.active.flatMap((task) => {
		const previousSortPosition = previousSortPositions.get(task.id);

		if(previousSortPosition === undefined || previousSortPosition === task.sortPosition) {
			return [];
		}

		return [{
			taskId: task.id,
			change: {
				sortPosition: task.sortPosition
			}
		}];
	});
};

const TasksPage = (): ReactElement => {
	const [ taskState, setTaskState ] = useState(getInitialTaskState());
	const [ taskStartupState, setTaskStartupState ] = useState<TaskStartupState>({ state: 'loading' });
	const [ taskStorageWarning, setTaskStorageWarning ] = useState<string | undefined>();
	const [ taskStorageStatus, setTaskStorageStatus ] = useState<StorageStatus | undefined>();
	const taskStateRef = useRef(taskState);

	const commitTaskState = (nextTaskState: TaskStateContainer): void => {
		taskStateRef.current = nextTaskState;
		setTaskState(nextTaskState);
	};

	const reconcileAfterTaskStorageFailure = async(
		spotStorage: NonNullable<typeof window.spotStorage>,
		message: string,
		fallbackTaskState: TaskStateContainer
	): Promise<void> => {
		setTaskStorageWarning(`Task storage update failed. ${message}`);

		try {
			const loadTasksResult = await spotStorage.loadTasks();
			setTaskStorageStatus(loadTasksResult.status);

			if(loadTasksResult.ok) {
				commitTaskState(loadTasksIntoTaskState(taskStateRef.current, loadTasksResult.tasks));
			}
			else {
				commitTaskState(fallbackTaskState);
			}
		}
		catch {
			const currentStorageStatus = await tryReadTaskStorageStatus(spotStorage);

			if(currentStorageStatus) {
				setTaskStorageStatus(currentStorageStatus);
			}

			commitTaskState(fallbackTaskState);
		}
	};

	const executeOptimisticTaskCommand = async(
		command: TaskStorageCommand,
		fallbackTaskState: TaskStateContainer
	): Promise<void> => {
		const spotStorage = window.spotStorage;

		if(!spotStorage) {
			return;
		}

		setTaskStorageWarning(undefined);

		try {
			const commandResult = await spotStorage.executeTaskCommand(command);
			setTaskStorageStatus(commandResult.status);

			if(!commandResult.ok) {
				await reconcileAfterTaskStorageFailure(spotStorage, commandResult.message, fallbackTaskState);
			}
		}
		catch(error) {
			await reconcileAfterTaskStorageFailure(spotStorage, getErrorMessage(error), fallbackTaskState);
		}
	};

	const applyOptimisticTaskCommand = (
		createMutation: (currentTaskState: TaskStateContainer) => {
			taskState: TaskStateContainer;
			command?: TaskStorageCommand;
		}
	): void => {
		const previousTaskState = taskStateRef.current;
		const { taskState: nextTaskState, command } = createMutation(previousTaskState);

		commitTaskState(nextTaskState);

		if(command) {
			void executeOptimisticTaskCommand(command, previousTaskState);
		}
	};

	useEffect(() => {
		let didCancelStartupLoad = false;

		const loadStartupTasks = async(): Promise<void> => {
			const spotStorage = window.spotStorage;

			if(!spotStorage) {
				const storageStatus: StorageStatus = {
					database: {
						state: 'unavailable',
						message: ELECTRON_STORAGE_API_UNAVAILABLE_MESSAGE
					}
				};

				setTaskStorageStatus(storageStatus);
				setTaskStartupState({
					state: 'startup-error',
					message: ELECTRON_STORAGE_API_UNAVAILABLE_MESSAGE
				});

				return;
			}

			try {
				const loadTasksResult = await spotStorage.loadTasks();

				if(didCancelStartupLoad) {
					return;
				}

				if(loadTasksResult.ok) {
					commitTaskState(loadTasksIntoTaskState(taskStateRef.current, loadTasksResult.tasks));
					setTaskStartupState({ state: 'loaded' });
					setTaskStorageStatus(loadTasksResult.status);
				}
				else {
					setTaskStorageStatus(loadTasksResult.status);
					setTaskStartupState({
						state: 'startup-error',
						message: loadTasksResult.message
					});
				}
			}
			catch(error) {
				if(!didCancelStartupLoad) {
					const currentStorageStatus = await tryReadTaskStorageStatus(spotStorage);

					if(didCancelStartupLoad) {
						return;
					}

					if(currentStorageStatus) {
						setTaskStorageStatus(currentStorageStatus);
					}

					setTaskStartupState({
						state: 'startup-error',
						message: getErrorMessage(error)
					});
				}
			}
		};

		void loadStartupTasks();

		return () => {
			didCancelStartupLoad = true;
		};
	}, []);

	const onFilterChange = (changedFilters: TaskFilterChange): void => {
		commitTaskState(changeFiltersInTaskState(taskStateRef.current, changedFilters));
	};

	const onResetDefaultFilters = (): void => {
		commitTaskState(resetFiltersTaskState(taskStateRef.current));
	};

	const onRefreshTasks = (): void => {
		commitTaskState(refreshVisibleTasksInTaskState(taskStateRef.current));
	};

	const onMoveActiveTask = (fromIndex: number, toIndex: number): void => {
		applyOptimisticTaskCommand((currentTaskState) => {
			const result = moveActiveTaskInTaskState(currentTaskState, fromIndex, toIndex);
			const updates = createSortPositionUpdates(result.previousTasksContainer, result.taskState.tasksContainer);

			return {
				taskState: result.taskState,
				command: updates.length > 0 ?
					{
						command: 'tasks.updateMany',
						payload: {
							reason: 'manual-reorder',
							updates
						}
					} :
					undefined
			};
		});
	};

	const onSortTasksByImportance = (): void => {
		applyOptimisticTaskCommand((currentTaskState) => {
			const result = sortTasksByImportanceInTaskState(currentTaskState);
			const updates = createSortPositionUpdates(result.previousTasksContainer, result.taskState.tasksContainer);

			return {
				taskState: result.taskState,
				command: updates.length > 0 ?
					{
						command: 'tasks.updateMany',
						payload: {
							reason: 'importance-sort',
							updates
						}
					} :
					undefined
			};
		});
	};

	const onAddNewTask = (): void => {
		applyOptimisticTaskCommand((currentTaskState) => {
			const result = addTaskToTaskState(currentTaskState);

			return {
				taskState: result.taskState,
				command: {
					command: 'task.create',
					payload: {
						task: taskToPersistedTask(result.task)
					}
				}
			};
		});
	};

	const onUpdateTask = (oldTask: Task, changedValues: TaskChange): void => {
		applyOptimisticTaskCommand((currentTaskState) => {
			const result = updateTaskInTaskState(currentTaskState, oldTask, changedValues);
			const change = createPersistedTaskChange(oldTask, result.task);

			return {
				taskState: result.taskState,
				command: hasPersistedTaskChange(change) ?
					{
						command: 'task.update',
						payload: {
							taskId: oldTask.id,
							change
						}
					} :
					undefined
			};
		});
	};

	const onDeleteTask = (task: Task): void => {
		applyOptimisticTaskCommand((currentTaskState) => {
			return {
				taskState: deleteTaskFromTaskState(currentTaskState, task),
				command: {
					command: 'task.delete',
					payload: {
						taskId: task.id
					}
				}
			};
		});
	};

	const taskStorageFeedback = createTaskStorageFeedback(taskStorageWarning, taskStorageStatus);

	if(taskStartupState.state === 'loading') {
		return (
			<Page>
				<Pane relativeSize={1}>
					<div className='tasks-page-status' role='status'>
						Loading tasks...
					</div>
				</Pane>
			</Page>
		);
	}

	if(taskStartupState.state === 'startup-error') {
		return (
			<Page>
				<Pane relativeSize={1}>
					<div className='tasks-page-status tasks-page-status-error' role='alert'>
						<h3 className='tasks-page-status-title'>Task storage is unavailable</h3>
						<p className='tasks-page-status-message'>{taskStartupState.message}</p>
					</div>
				</Pane>
			</Page>
		);
	}

	return (
		<Page>
			<Pane relativeSize={1}>
				<TaskFilters
					domains={taskState.domainsContainer.filters}
					filters={taskState.filters}
					onFilterChange={onFilterChange}
					onResetDefaultFilters={onResetDefaultFilters}
				/>
			</Pane>
			<Pane relativeSize={2}>
				{taskStorageFeedback &&
					<div className='tasks-page-storage-feedback' role={taskStorageFeedback.role}>
						<h3 className='tasks-page-storage-feedback-title'>{taskStorageFeedback.title}</h3>
						<p className='tasks-page-storage-feedback-message'>{taskStorageFeedback.message}</p>
						{taskStorageFeedback.statusMessage &&
							<p className='tasks-page-storage-feedback-message'>{taskStorageFeedback.statusMessage}</p>
						}
					</div>
				}
				<TasksList
					title='Tasks'
					tasks={taskState.tasksContainer.active}
					inputDomains={taskState.domainsContainer.form}
					onUpdateTask={onUpdateTask}
					onDeleteTask={onDeleteTask}
					showActions={true}
					onRefreshTasks={onRefreshTasks}
					onMoveTask={onMoveActiveTask}
					onSortTasksByImportance={onSortTasksByImportance}
					onAddNewTask={onAddNewTask}
				/>
				{taskState.filters.showCompleted &&
					<TasksList
						title='Completed Tasks'
						tasks={taskState.tasksContainer.completed}
						inputDomains={taskState.domainsContainer.form}
						onUpdateTask={onUpdateTask}
						onDeleteTask={onDeleteTask}
						showActions={false}
					/>
				}
			</Pane>
		</Page>
	);
};

export { TasksPage };
