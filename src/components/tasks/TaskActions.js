import './TaskActions.css';
import { useState } from 'react';
import Checkbox from '../inputs/Checkbox';
import Clickable from '../common/Clickable';
import DeleteIcon from '../icons/DeleteIcon';
import ConfirmModal from '../common/ConfirmModal';

const TaskActions = ({ task, onChangeState, onDelete }) => {
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
