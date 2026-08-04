import 'src/components/tasks/TasksPage.css';
import { useState, useEffect, useRef, type ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { clearPendingTaskChanges, flushPendingTaskChanges, registerPendingTaskChangesApplier, type PendingTaskChanges } from 'src/logic/PendingTaskChanges';
import { clearTaskStorageFailures, getTaskStorageQueueState, sendTaskStorageCommand, subscribeToTaskStorageQueue } from 'src/logic/TaskStorageQueue';
import { findTaskById } from 'src/logic/TasksLogic';
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

// The tag still sitting in the trailing tag input becomes a real tag only when the buffered changes are saved
const createChangedTaskValues = (oldTask: Task, pendingChanges: PendingTaskChanges): TaskChange => {
	if(!pendingChanges.newTag) {
		return pendingChanges.change;
	}

	return {
		...pendingChanges.change,
		tags: [ ...pendingChanges.change.tags ?? oldTask.tags, pendingChanges.newTag ]
	};
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

	// The database itself is fine here, so a failing backup is reported as a notice: the tasks are saved either way
	if(taskStorageStatus?.backup?.state === 'failed') {
		return {
			role: 'status',
			title: 'Backup copies are not being written',
			message: 'Your tasks are saved, but SPOT could not write a backup copy to the backup folder. You can check the folder in Settings.',
			statusMessage: taskStorageStatus.backup.message
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

	// A write failure leaves the task state alone: it holds what the user wanted, and reloading the database over it
	// would throw that away. The queue keeps retrying the write and warns for as long as it has not gone through.
	const applyOptimisticTaskCommand = (
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
	};

	useEffect(() => {
		let didCancelStartupLoad = false;

		setTaskStartupState({ state: 'loading' });
		setTaskStorageWarning(undefined);

		// The task state is about to be replaced by what the database holds, so warnings about the old one no longer apply
		clearTaskStorageFailures();

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
	}, []);

	// Backups run on a timer, so their outcome arrives on its own instead of riding on the answer to a task command
	useEffect(() => {
		const spotStorage = window.spotStorage as SpotStorageApi | undefined;

		return spotStorage?.onBackupStatusChanged?.((backup) => {
			setTaskStorageStatus((currentStorageStatus) => {
				return currentStorageStatus ? { ...currentStorageStatus, backup } : currentStorageStatus;
			});
		});
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

	// Buffered task changes are applied against the task as it is now, not as it was when the user started editing it
	const onApplyPendingTaskChanges = (taskId: string, pendingChanges: PendingTaskChanges): void => {
		applyOptimisticTaskCommand((currentTaskState) => {
			const oldTask = findTaskById(currentTaskState.tasksContainer, taskId);

			// The task was deleted while its changes were buffered, so there is nothing left to update
			if(!oldTask) {
				return {
					taskState: currentTaskState
				};
			}

			const changedValues = createChangedTaskValues(oldTask, pendingChanges);

			if(Object.keys(changedValues).length === 0) {
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
	};

	// The applier is registered once, so it reaches the latest render through a ref
	const applyPendingTaskChangesRef = useRef(onApplyPendingTaskChanges);
	useEffect(() => {
		applyPendingTaskChangesRef.current = onApplyPendingTaskChanges;
	});

	useEffect(() => {
		const unregisterApplier = registerPendingTaskChangesApplier((taskId, pendingChanges) => {
			applyPendingTaskChangesRef.current(taskId, pendingChanges);
		});

		return () => {
			// Leaving the page removes the only applier, so anything still buffered must be saved before unregistering it
			flushPendingTaskChanges();
			unregisterApplier();
		};
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

	const onDeleteTask = (task: Task): void => {
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
						onDeleteTask={onDeleteTask}
						showActions={false}
					/>
				}
			</Pane>
		</Page>
	);
};

export { TasksPage };
