import './TaskActions.css';
import Checkbox from '../inputs/Checkbox';
import Clickable from '../common/Clickable';
import DeleteIcon from '../icons/DeleteIcon';

const TaskActions = ({ task, onChangeState, onDelete }) => {
	const {
		state
	} = task;

	return (
		<div className='task-actions'>
			<Checkbox
				value={state === 'COMPLETED'}
				onChange={onChangeState}/>
			<Clickable onClick={onDelete}>
				<DeleteIcon/>
			</Clickable>
		</div>
	);
};

export default TaskActions;
