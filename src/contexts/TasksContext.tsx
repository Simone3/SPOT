import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AUDIT_CONFIG } from 'src/config/AppConfig';
import { reportTaskStateDrift } from 'src/logic/Diagnostics';
import { clearPendingTaskChanges, flushPendingTaskChanges, hasPendingTaskChanges, registerPendingTaskChangesApplier } from 'src/logic/PendingTaskChanges';
import { createPersistedTaskChange, hasPersistedTaskChange, taskToPersistedTask } from 'src/logic/TaskComparison';
import { auditTaskState, createTaskStateAuditMessage } from 'src/logic/TaskStateAudit';
import { getTaskStorageQueueState, isTaskStorageQueueIdle, sendTaskStorageCommand, setTaskStorageQueueTranslator, subscribeToTaskStorageQueue } from 'src/logic/TaskStorageQueue';
import { findTaskById } from 'src/logic/TasksLogic';
import { useTranslator } from 'src/i18n/TranslationContext';
import { getInitialTaskState, addTaskToTaskState, refreshVisibleTasksInTaskState, deleteTaskFromTaskState, changeFiltersInTaskState, loadTasksIntoTaskState, resetFiltersTaskState, updateTaskInTaskState, sortTasksByImportanceInTaskState, moveActiveTaskInTaskState, type TaskStateContainer } from 'src/logic/TaskStateLogic';
import type { PersistedTaskChange, Task, TaskChange, TasksContainer } from 'src/types/TaskTypes';
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
	taskStateAuditWarning: string | undefined;
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

const getErrorMessage = (error: unknown): string => {
	if(error instanceof Error) {
		return error.message;
	}

	if(error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message;
	}

	return String(error);
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
	const translator = useTranslator();
	const [ taskState, setTaskState ] = useState(getInitialTaskState);
	const [ taskStartupState, setTaskStartupState ] = useState<TaskStartupState>({ state: 'loading' });
	const [ taskStorageWarning, setTaskStorageWarning ] = useState<string | undefined>();
	const [ taskStorageStatus, setTaskStorageStatus ] = useState<StorageStatus | undefined>();
	const [ taskStateAuditWarning, setTaskStateAuditWarning ] = useState<string | undefined>();
	const taskStateRef = useRef(taskState);

	// The effects below must not restart when the language changes: the startup load runs exactly once, and the audit schedule
	// is deliberately its own. They therefore reach the current translator through a ref rather than through their dependencies.
	const translatorRef = useRef(translator);
	useEffect(() => {
		translatorRef.current = translator;
	});

	// The write queue is created before anything mounts and words its failures whenever one happens, so it is told the language instead of asking for it
	useEffect(() => {
		setTaskStorageQueueTranslator(translator);
	}, [ translator ]);

	// Counts task state changes so that the audit can tell whether the one it started against is still the current one
	const taskStateGenerationRef = useRef(0);

	const commitTaskState = useCallback((nextTaskState: TaskStateContainer): void => {
		taskStateRef.current = nextTaskState;
		taskStateGenerationRef.current += 1;
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
				const unavailableMessage = translatorRef.current.t('storage.electronOnly');
				const storageStatus: StorageStatus = {
					database: {
						state: 'unavailable',
						message: unavailableMessage
					}
				};

				setTaskStorageStatus(storageStatus);
				setTaskStartupState({
					state: 'startup-error',
					message: unavailableMessage
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

	// Task updates are optimistic and tasks are only read at startup, so nothing would notice a change that never reached the
	// database until the next launch showed the task without it. The audit reads the database back while the application runs
	// and reports what the two do not agree on. It only reads: the task state is never reconciled, because it holds what the
	// user wanted and the audit has no way of knowing which of the two sides is the mistaken one.
	useEffect(() => {
		const spotStorage = window.spotStorage as SpotStorageApi | undefined;

		if(!AUDIT_CONFIG.enabled || taskStartupState.state !== 'loaded' || !spotStorage) {
			return undefined;
		}

		let didCancelAudit = false;
		let auditTimeout: ReturnType<typeof setTimeout> | undefined;

		// Everything the user changed is on its way to the database until the buffer is empty and the queue has drained, so the task
		// state being ahead of it is the write path working as designed and not a drift. A change the queue gave up on is already
		// reported as unsaved, and it is a difference the audit would keep finding for the rest of the session.
		const isTaskStateQuiescent = (): boolean => {
			return !document.hidden &&
				!hasPendingTaskChanges() &&
				isTaskStorageQueueIdle() &&
				!getTaskStorageQueueState().unsavedChangesMessage;
		};

		const runAudit = async(): Promise<void> => {
			if(!isTaskStateQuiescent()) {
				return;
			}

			const auditedGeneration = taskStateGenerationRef.current;
			const loadTasksResult = await spotStorage.loadTasks().catch(() => {
				return undefined;
			});

			// A database that cannot be read is not a drift, and it is already reported through the storage status. The user can also
			// change anything while it is being read, so an audit that raced a change reports that change instead of a drift: it is
			// dropped, and the next one runs against a task state that has settled again.
			if(didCancelAudit ||
				!loadTasksResult?.ok ||
				auditedGeneration !== taskStateGenerationRef.current ||
				!isTaskStateQuiescent()) {
				return;
			}

			const { tasksContainer } = taskStateRef.current;
			const report = auditTaskState([ ...tasksContainer.active, ...tasksContainer.completed ], loadTasksResult.tasks);

			if(report.isAligned) {
				return;
			}

			// The message says how much drifted, while the log file holds which tasks and which fields
			const logFilePath = await reportTaskStateDrift(report);

			if(didCancelAudit) {
				return;
			}

			setTaskStateAuditWarning(createTaskStateAuditMessage(report, translatorRef.current, logFilePath));
		};

		// The audit reschedules itself instead of running on an interval, so a read waiting behind a write or a backup can never
		// have another one queued up behind it
		const scheduleAudit = (delayMs: number): void => {
			auditTimeout = setTimeout(() => {
				void runAudit().then(() => {
					if(!didCancelAudit) {
						scheduleAudit(AUDIT_CONFIG.intervalMs);
					}
				});
			}, delayMs);
		};

		scheduleAudit(AUDIT_CONFIG.initialDelayMs);

		return () => {
			didCancelAudit = true;

			if(auditTimeout) {
				clearTimeout(auditTimeout);
			}
		};
	}, [ taskStartupState.state ]);

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
			taskStateAuditWarning,
			onFilterChange,
			onResetDefaultFilters,
			onRefreshTasks,
			onMoveActiveTask,
			onSortTasksByImportance,
			onAddNewTask,
			onDeleteTask
		};
	}, [ taskState, taskStartupState, taskStorageWarning, taskStorageStatus, taskStateAuditWarning, onFilterChange, onResetDefaultFilters, onRefreshTasks, onMoveActiveTask, onSortTasksByImportance, onAddNewTask, onDeleteTask ]);

	return (
		<TasksContext.Provider value={contextValue}>
			{children}
		</TasksContext.Provider>
	);
};
