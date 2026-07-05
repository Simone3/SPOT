import type { SpotDatabase } from 'src/main/storage/SpotDatabase';
import { deleteTaskRecord, insertTaskRecord, runTaskTransaction, updateTaskRecord, withSpotDatabase, type TaskRepositoryOptions } from 'src/main/storage/TaskRepository';
import type { TaskStorageCommand } from 'src/types/TaskStorageTypes';

interface TaskCommandExecutionOptions {
	now?: () => Date;
}

const getCurrentDate = (options: TaskCommandExecutionOptions): Date => {
	if(options.now) {
		return options.now();
	}

	return new Date();
};

const applyTaskCommand = (spotDatabase: SpotDatabase, command: TaskStorageCommand, writtenAt: Date): void => {
	switch(command.command) {
		case 'task.create':
			insertTaskRecord(spotDatabase, command.payload.task, writtenAt);
			break;

		case 'task.update':
			updateTaskRecord(spotDatabase, command.payload.taskId, command.payload.change, writtenAt);
			break;

		case 'task.delete':
			deleteTaskRecord(spotDatabase, command.payload.taskId);
			break;

		case 'tasks.updateMany':
			command.payload.updates.forEach((update) => {
				updateTaskRecord(spotDatabase, update.taskId, update.change, writtenAt);
			});
			break;

		default:
			throw new Error(`Unsupported task storage command "${(command as TaskStorageCommand).command}".`);
	}
};

export const executeTaskCommandOnDatabase = (
	spotDatabase: SpotDatabase,
	options: TaskCommandExecutionOptions,
	command: TaskStorageCommand
): void => {
	const writtenAt = getCurrentDate(options);

	runTaskTransaction(spotDatabase, () => {
		applyTaskCommand(spotDatabase, command, writtenAt);
	});
};

export const executeTaskCommandInStorage = (
	options: TaskRepositoryOptions,
	command: TaskStorageCommand
): void => {
	withSpotDatabase(options, (spotDatabase) => {
		executeTaskCommandOnDatabase(spotDatabase, options, command);
	});
};
