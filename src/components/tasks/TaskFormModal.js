import { useState } from 'react';
import FreeSelectInput from '../inputs/FreeSelectInput';
import TextArea from '../inputs/TextArea';
import './TaskFormModal.css';
import DatePicker from '../inputs/DatePicker';

const TaskFormModal = ({ initialTask, onSave, onDiscard, onDelete }) => {
	const [ text, setText ] = useState('');
	const [ owner, setOwner ] = useState('');
	const [ dueDate, setDueDate ] = useState('');

	return (
		<div className='task-form-modal-background'>
			<div className='task-form-modal-content'>
				<h3 className='task-form-title'>Add Task</h3>
				<TextArea placeholder={'Task content...'} value={text} onChange={setText}/>
				<FreeSelectInput placeholder='No owner (me)' value={owner} onChange={setOwner} options={[ 'Some Guy', 'Somebody', 'That Guy', 'Someone' ]}/>
				<DatePicker value={dueDate} onChange={setDueDate}/>
				<button onClick={onSave}>Save</button>
				<button onClick={onDiscard}>Discard</button>
				<button onClick={onDelete}>Delete</button>
			</div>
		</div>
	);
};

export default TaskFormModal;
