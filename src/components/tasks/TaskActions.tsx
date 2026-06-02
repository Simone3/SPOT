import 'src/components/tasks/TaskActions.css';
import { useState, type ReactElement, type ReactNode } from 'react';
import { Checkbox } from 'src/components/inputs/Checkbox';
import { DeleteIcon } from 'src/components/icons/DeleteIcon';
import { ConfirmModal } from 'src/components/common/ConfirmModal';
import type { Task } from 'src/types/TaskTypes';
import { Clickable } from 'src/components/common/Clickable';

type TaskActionsProps = {
	task: Task;
	onChangeState: () => void;
	onDelete: () => void;
	dragHandle?: ReactNode;
	disableSecondaryActions?: boolean;
};

const TaskActions = ({ task, onChangeState, onDelete, dragHandle, disableSecondaryActions }: TaskActionsProps): ReactElement => {
	const {
		state
	} = task;

	const [ confirmOpen, setConfirmOpen ] = useState(false);

	return (
		<div className='task-actions'>
			{dragHandle}
			<Checkbox
				value={state === 'COMPLETED'}
				onChange={onChangeState}/>
			<Clickable className='delete-button' disabled={disableSecondaryActions} onClick={() => {
				setConfirmOpen(true);
			}}>
				<DeleteIcon/>
			</Clickable>
			{confirmOpen &&
				<ConfirmModal
					title='Delete task?'
					content={
						<>
							<p>This will permanently delete this task.</p>
							<p>This action cannot be undone.</p>
						</>
					}
					confirmText='Delete Task'
					onConfirm={onDelete}
					cancelText='Keep Task'
					onCancel={() => {
						setConfirmOpen(false);
					}}
				/>
			}
		</div>
	);
};

export { TaskActions };
