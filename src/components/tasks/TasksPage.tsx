import 'src/components/tasks/TasksPage.css';
import { useContext, type ReactElement } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { TasksContext } from 'src/contexts/TasksContext';
import type { StorageStatus } from 'src/types/TaskStorageTypes';
import { TasksList } from 'src/components/tasks/TasksList';
import { TaskFilters } from 'src/components/tasks/TaskFilters';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SpotTranslator } from 'src/i18n/Translations';

interface TaskStorageFeedback {
	role: 'alert' | 'status';
	title: string;
	message: string;
	statusMessage?: string;
}

const createStorageStatusMessage = (storageStatus: StorageStatus, translator: SpotTranslator): string | undefined => {
	if(storageStatus.database.state === 'healthy') {
		return undefined;
	}

	const state = translator.t(`storage.databaseStates.${storageStatus.database.state}`);

	return storageStatus.database.message ?
		translator.t('storage.databaseStatusWithMessage', { state, message: storageStatus.database.message }) :
		translator.t('storage.databaseStatus', { state });
};

const createTaskStorageFeedback = (
	taskStorageWarning: string | undefined,
	taskStorageStatus: StorageStatus | undefined,
	taskStateAuditWarning: string | undefined,
	translator: SpotTranslator
): TaskStorageFeedback | undefined => {
	const statusMessage = taskStorageStatus ? createStorageStatusMessage(taskStorageStatus, translator) : undefined;

	if(taskStorageWarning) {
		return {
			role: 'alert',
			title: translator.t('storage.unsavedChangesTitle'),
			message: taskStorageWarning,
			statusMessage
		};
	}

	if(statusMessage) {
		return {
			role: taskStorageStatus?.database.state === 'unavailable' ? 'alert' : 'status',
			title: translator.t('storage.needsAttentionTitle'),
			message: statusMessage
		};
	}

	// The database itself is fine here, so a failing backup is reported as a notice: the tasks are saved either way
	if(taskStorageStatus?.backup?.state === 'failed') {
		return {
			role: 'status',
			title: translator.t('storage.backupFailedTitle'),
			message: translator.t('storage.backupFailedMessage'),
			statusMessage: taskStorageStatus.backup.message
		};
	}

	// The audit only compares, so what it found is reported below every failure that means something is not being saved right now
	if(taskStateAuditWarning) {
		return {
			role: 'status',
			title: translator.t('audit.driftTitle'),
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
	const translator = useTranslator();
	const { t } = translator;
	const taskStorageFeedback = createTaskStorageFeedback(taskStorageWarning, taskStorageStatus, taskStateAuditWarning, translator);

	if(taskStartupState.state === 'loading') {
		return (
			<Page>
				<Pane relativeSize={1}>
					<div className='tasks-page-status' role='status'>
						{t('tasks.loading')}
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
						<h3 className='tasks-page-status-title'>{t('storage.startupErrorTitle')}</h3>
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
					title={t('tasks.activeListTitle')}
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
						title={t('tasks.completedListTitle')}
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
