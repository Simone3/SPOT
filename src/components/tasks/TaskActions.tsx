import 'src/components/tasks/TaskActions.css';
import { useState, type ReactElement, type ReactNode } from 'react';
import { Checkbox } from 'src/components/inputs/Checkbox';
import { DeleteIcon } from 'src/components/icons/DeleteIcon';
import { ConfirmModal } from 'src/components/common/ConfirmModal';
import type { Task } from 'src/types/TaskTypes';

type TaskActionsProps = {
	task: Task;
	onChangeState: () => void;
	onDelete: () => void;
	dragHandle?: ReactNode;
};

const TaskActions = ({ task, onChangeState, onDelete, dragHandle }: TaskActionsProps): ReactElement => {
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
			<button
				type='button'
				className='task-action-delete-button'
				aria-label='Delete task'
				title='Delete task'
				onClick={() => {
					setConfirmOpen(true);
				}}>
				<DeleteIcon/>
			</button>
			{confirmOpen &&
				<ConfirmModal
					title='Delete Task?'
					content='This action cannot be undone.'
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
