import 'src/components/tasks/TaskDragHandle.css';
import { forwardRef, type ReactElement } from 'react';
import { DragHandleIcon } from 'src/components/icons/DragHandleIcon';

export type TaskDragHandleVariant = 'leading' | 'divider' | 'actions';

type TaskDragHandleProps = {
	variant: TaskDragHandleVariant;
};

const TASK_DRAG_HANDLE_LABELS: Record<TaskDragHandleVariant, string> = {
	leading: 'Preview A: drag task beside the priority rail',
	divider: 'Preview B: drag task between content and actions',
	actions: 'Preview C: drag task from the action column'
};

const TaskDragHandle = forwardRef<HTMLButtonElement, TaskDragHandleProps>(({ variant }, ref): ReactElement => {
	const label = TASK_DRAG_HANDLE_LABELS[variant];

	return (
		<button
			type='button'
			ref={ref}
			className={`task-drag-handle task-drag-handle-${variant}`}
			aria-label={label}
			title={label}>
			<DragHandleIcon/>
		</button>
	);
});

TaskDragHandle.displayName = 'TaskDragHandle';

export { TaskDragHandle };
