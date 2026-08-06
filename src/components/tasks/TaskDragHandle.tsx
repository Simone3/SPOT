import 'src/components/tasks/TaskDragHandle.css';
import { forwardRef, type ReactElement } from 'react';
import { DragHandleIcon } from 'src/components/icons/DragHandleIcon';
import { useTranslator } from 'src/i18n/TranslationContext';

type TaskDragHandleProps = {
	disabled?: boolean;
};

const TaskDragHandle = forwardRef<HTMLButtonElement, TaskDragHandleProps>(({ disabled }, ref): ReactElement => {
	const { t } = useTranslator();
	const dragLabel = t('tasks.actions.drag');

	return (
		<button
			type='button'
			ref={ref}
			className='task-drag-handle task-drag-handle-actions'
			aria-label={dragLabel}
			title={dragLabel}
			disabled={disabled}>
			<DragHandleIcon/>
		</button>
	);
});

TaskDragHandle.displayName = 'TaskDragHandle';

export { TaskDragHandle };
