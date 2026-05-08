import 'src/components/tasks/TaskActions.css';
import { useState, type ReactElement } from 'react';
import Checkbox from 'src/components/inputs/Checkbox';
import Clickable from 'src/components/common/Clickable';
import DeleteIcon from 'src/components/icons/DeleteIcon';
import ConfirmModal from 'src/components/common/ConfirmModal';
import type { Task } from 'src/types/TaskTypes';

type TaskActionsProps = {
	task: Task;
	onChangeState: () => void;
	onDelete: () => void;
};

const TaskActions = ({ task, onChangeState, onDelete }: TaskActionsProps): ReactElement => {
	const {
		state
	} = task;

	const [ confirmOpen, setConfirmOpen ] = useState(false);

	return (
		<div className='task-actions'>
			<Checkbox
				value={state === 'COMPLETED'}
				onChange={onChangeState}/>
			<Clickable onClick={() => {
				setConfirmOpen(true);
			}}>
				<DeleteIcon/>
			</Clickable>
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

export default TaskActions;
