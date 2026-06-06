import type { TaskDatabase } from 'src/main/storage/TaskDatabase';
import { deleteTaskRecord, insertTaskRecord, runTaskTransaction, updateTaskRecord, withTaskDatabase, type TaskSqlRepositoryOptions } from 'src/main/storage/TaskSqlRepository';
import type { TaskStorageCommand } from 'src/main/storage/TaskStorage';

const getCurrentDate = (options: TaskSqlRepositoryOptions): Date => {
	if(options.now) {
		return options.now();
	}

	return new Date();
};

const applyTaskCommand = (taskDatabase: TaskDatabase, command: TaskStorageCommand, writtenAt: Date): void => {
	switch(command.command) {
		case 'task.create':
			insertTaskRecord(taskDatabase, command.payload.task, writtenAt);
			break;

		case 'task.update':
			updateTaskRecord(taskDatabase, command.payload.taskId, command.payload.change, writtenAt);
			break;

		case 'task.delete':
			deleteTaskRecord(taskDatabase, command.payload.taskId);
			break;

		case 'tasks.updateMany':
			command.payload.updates.forEach((update) => {
				updateTaskRecord(taskDatabase, update.taskId, update.change, writtenAt);
			});
			break;

		default:
			throw new Error(`Unsupported task storage command "${(command as TaskStorageCommand).command}".`);
	}
};

export const executeTaskCommandInStorage = (
	options: TaskSqlRepositoryOptions,
	command: TaskStorageCommand
): void => {
	withTaskDatabase(options, (taskDatabase) => {
		const writtenAt = getCurrentDate(options);

		runTaskTransaction(taskDatabase, () => {
			applyTaskCommand(taskDatabase, command, writtenAt);
		});
	});
};
