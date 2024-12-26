import { useState } from 'react';
import FreeSelectInput from '../inputs/FreeSelectInput';
import TextArea from '../inputs/TextArea';
import './TaskFormModal.css';

const TaskFormModal = ({ initialTask, onSave, onDiscard, onDelete }) => {
	const [ owner, setOwner ] = useState('');

	return (
		<div className='task-form-modal-background'>
			<div className='task-form-modal-content'>
				<h3 className='task-form-title'>Add Task</h3>
				<TextArea placeholder={'Task content...'}/>
				<FreeSelectInput placeholder={'No owner (me)'} value={owner} onChange={setOwner} options={[ 'Some Guy', 'Somebody', 'That Guy', 'Someone' ]}/>
				<button onClick={onSave}>Save</button>
				<button onClick={onDiscard}>Discard</button>
				<button onClick={onDelete}>Delete</button>
			</div>
		</div>
	);
};

export default TaskFormModal;
