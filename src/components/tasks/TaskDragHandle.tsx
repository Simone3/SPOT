import 'src/components/tasks/TaskDragHandle.css';
import { forwardRef, type ReactElement } from 'react';
import { DragHandleIcon } from 'src/components/icons/DragHandleIcon';

type TaskDragHandleProps = {
	disabled?: boolean;
};

const TaskDragHandle = forwardRef<HTMLButtonElement, TaskDragHandleProps>(({ disabled }, ref): ReactElement => {
	return (
		<button
			type='button'
			ref={ref}
			className='task-drag-handle task-drag-handle-actions'
			aria-label='Drag task'
			title='Drag task'
			disabled={disabled}>
			<DragHandleIcon/>
		</button>
	);
});

TaskDragHandle.displayName = 'TaskDragHandle';

export { TaskDragHandle };
