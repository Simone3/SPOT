import 'src/components/tasks/TasksPage.css';
import { useContext, type ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { TasksContext } from 'src/contexts/TasksContext';
import type { StorageStatus } from 'src/types/TaskStorageTypes';
import { TasksList } from 'src/components/tasks/TasksList';
import { TaskFilters } from 'src/components/tasks/TaskFilters';

interface TaskStorageFeedback {
	role: 'alert' | 'status';
	title: string;
	message: string;
	statusMessage?: string;
}

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
	taskStorageStatus: StorageStatus | undefined,
	taskStateAuditWarning: string | undefined
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

	// The audit only compares, so what it found is reported below every failure that means something is not being saved right now
	if(taskStateAuditWarning) {
		return {
			role: 'status',
			title: 'Tasks on screen and stored tasks differ',
			message: taskStateAuditWarning
		};
	}

	return undefined;
};

// The task state lives in TasksContext, above the router, so leaving this page and coming back keeps the loaded tasks,
// the filters, and the manual sort order exactly as the user left them
const TasksPage = (): ReactElement => {
	const {
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
	} = useContext(TasksContext)!;
	const taskStorageFeedback = createTaskStorageFeedback(taskStorageWarning, taskStorageStatus, taskStateAuditWarning);

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
