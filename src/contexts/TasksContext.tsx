import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { clearPendingTaskChanges, flushPendingTaskChanges, registerPendingTaskChangesApplier } from 'src/logic/PendingTaskChanges';
import { getTaskStorageQueueState, sendTaskStorageCommand, subscribeToTaskStorageQueue } from 'src/logic/TaskStorageQueue';
import { findTaskById } from 'src/logic/TasksLogic';
import { getInitialTaskState, addTaskToTaskState, refreshVisibleTasksInTaskState, deleteTaskFromTaskState, changeFiltersInTaskState, loadTasksIntoTaskState, resetFiltersTaskState, updateTaskInTaskState, sortTasksByImportanceInTaskState, moveActiveTaskInTaskState, type TaskStateContainer } from 'src/logic/TaskStateLogic';
import type { PersistedTask, PersistedTaskChange, Task, TaskChange, TasksContainer } from 'src/types/TaskTypes';
import type { TaskFilterChange } from 'src/types/FilterTypes';
import type { SpotStorageApi, StorageStatus, TaskStorageCommand } from 'src/types/TaskStorageTypes';

export type TaskStartupState = {
	state: 'loading';
} | {
	state: 'loaded';
} | {
	state: 'startup-error';
	message: string;
};

/**
 * The task state and everything that mutates it. It lives above the router, so moving between pages never reloads the
 * database and never resets filters, domains, or the manual sort order.
 */
export interface TasksContextValue {
	taskState: TaskStateContainer;
	taskStartupState: TaskStartupState;
	taskStorageWarning: string | undefined;
	taskStorageStatus: StorageStatus | undefined;
	onFilterChange: (changedFilters: TaskFilterChange) => void;
	onResetDefaultFilters: () => void;
	onRefreshTasks: () => void;
	onMoveActiveTask: (fromIndex: number, toIndex: number) => void;
	onSortTasksByImportance: () => void;
	onAddNewTask: () => void;
	onDeleteTask: (task: Task) => void;
}

export const TasksContext = createContext<TasksContextValue | undefined>(undefined);

type TasksContextProviderProps = {
	children: ReactNode;
};

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

		// An empty tag is a tag input the user has not filled in yet, or one they just emptied: it is never persisted, and stripping
		// it on both sides of the comparison also keeps it from ever looking like a change
		tags: task.tags.filter((tag) => {
			return tag;
		}),
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

export const TasksContextProvider = ({ children }: TasksContextProviderProps): ReactElement => {
	const [ taskState, setTaskState ] = useState(getInitialTaskState());
	const [ taskStartupState, setTaskStartupState ] = useState<TaskStartupState>({ state: 'loading' });
	const [ taskStorageWarning, setTaskStorageWarning ] = useState<string | undefined>();
	const [ taskStorageStatus, setTaskStorageStatus ] = useState<StorageStatus | undefined>();
	const taskStateRef = useRef(taskState);

	const commitTaskState = useCallback((nextTaskState: TaskStateContainer): void => {
		taskStateRef.current = nextTaskState;
		setTaskState(nextTaskState);
	}, []);

	// A write failure leaves the task state alone: it holds what the user wanted, and reloading the database over it
	// would throw that away. The queue keeps retrying the write and warns for as long as it has not gone through.
	const applyOptimisticTaskCommand = useCallback((
		createMutation: (currentTaskState: TaskStateContainer) => {
			taskState: TaskStateContainer;
			command?: TaskStorageCommand;
		}
	): void => {
		const { taskState: nextTaskState, command } = createMutation(taskStateRef.current);

		commitTaskState(nextTaskState);

		if(command) {
			sendTaskStorageCommand(command);
		}
	}, [ commitTaskState ]);

	// Tasks are loaded exactly once, when the app starts and before any command can be queued, so nothing here has to be
	// ordered against the storage queue. A reload triggered later, while the user is working, would need that ordering:
	// it must await a bounded waitForTaskStorageQueue() first, so the database is never read before the queued writes are
	// applied over it, and it must clear the storage warnings only once the reload has actually succeeded.
	useEffect(() => {
		let didCancelStartupLoad = false;

		const loadStartupTasks = async(): Promise<void> => {
			const spotStorage = window.spotStorage as SpotStorageApi | undefined;

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
	}, [ commitTaskState ]);

	// Backups run on a timer, so their outcome arrives on its own instead of riding on the answer to a task command
	useEffect(() => {
		const spotStorage = window.spotStorage as SpotStorageApi | undefined;

		return spotStorage?.onBackupStatusChanged?.((backup) => {
			setTaskStorageStatus((currentStorageStatus) => {
				return currentStorageStatus ? { ...currentStorageStatus, backup } : currentStorageStatus;
			});
		});
	}, []);

	useEffect(() => {
		return subscribeToTaskStorageQueue(() => {
			const queueState = getTaskStorageQueueState();

			if(queueState.status) {
				setTaskStorageStatus(queueState.status);
			}

			setTaskStorageWarning(queueState.unsavedChangesMessage);
		});
	}, []);

	const onFilterChange = useCallback((changedFilters: TaskFilterChange): void => {
		commitTaskState(changeFiltersInTaskState(taskStateRef.current, changedFilters));
	}, [ commitTaskState ]);

	const onResetDefaultFilters = useCallback((): void => {
		commitTaskState(resetFiltersTaskState(taskStateRef.current));
	}, [ commitTaskState ]);

	const onRefreshTasks = useCallback((): void => {
		commitTaskState(refreshVisibleTasksInTaskState(taskStateRef.current));
	}, [ commitTaskState ]);

	const onMoveActiveTask = useCallback((fromIndex: number, toIndex: number): void => {
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
	}, [ applyOptimisticTaskCommand ]);

	const onSortTasksByImportance = useCallback((): void => {
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
	}, [ applyOptimisticTaskCommand ]);

	const onAddNewTask = useCallback((): void => {
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
	}, [ applyOptimisticTaskCommand ]);

	const onDeleteTask = useCallback((task: Task): void => {
		clearPendingTaskChanges(task.id);
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
	}, [ applyOptimisticTaskCommand ]);

	// Buffered task changes are applied against the task as it is now, not as it was when the user started editing it
	const onApplyPendingTaskChanges = useCallback((taskId: string, changedValues: TaskChange): void => {
		applyOptimisticTaskCommand((currentTaskState) => {
			const oldTask = findTaskById(currentTaskState.tasksContainer, taskId);

			// The task was deleted while its changes were buffered, so there is nothing left to update
			if(!oldTask) {
				return {
					taskState: currentTaskState
				};
			}

			const result = updateTaskInTaskState(currentTaskState, oldTask, changedValues);
			const change = createPersistedTaskChange(oldTask, result.task);

			return {
				taskState: result.taskState,
				command: hasPersistedTaskChange(change) ?
					{
						command: 'task.update',
						payload: {
							taskId,
							change
						}
					} :
					undefined
			};
		});
	}, [ applyOptimisticTaskCommand ]);

	// The applier is registered once, so it reaches the latest render through a ref
	const applyPendingTaskChangesRef = useRef(onApplyPendingTaskChanges);
	useEffect(() => {
		applyPendingTaskChangesRef.current = onApplyPendingTaskChanges;
	});

	useEffect(() => {
		const unregisterApplier = registerPendingTaskChangesApplier((taskId, changedValues) => {
			applyPendingTaskChangesRef.current(taskId, changedValues);
		});

		return () => {
			// The provider lives as long as the renderer, so this only runs on teardown, and anything still buffered
			// must be saved before the only applier goes away
			flushPendingTaskChanges();
			unregisterApplier();
		};
	}, []);

	const contextValue = useMemo((): TasksContextValue => {
		return {
			taskState,
			taskStartupState,
			taskStorageWarning,
			taskStorageStatus,
			onFilterChange,
			onResetDefaultFilters,
			onRefreshTasks,
			onMoveActiveTask,
			onSortTasksByImportance,
			onAddNewTask,
			onDeleteTask
		};
	}, [ taskState, taskStartupState, taskStorageWarning, taskStorageStatus, onFilterChange, onResetDefaultFilters, onRefreshTasks, onMoveActiveTask, onSortTasksByImportance, onAddNewTask, onDeleteTask ]);

	return (
		<TasksContext.Provider value={contextValue}>
			{children}
		</TasksContext.Provider>
	);
};
