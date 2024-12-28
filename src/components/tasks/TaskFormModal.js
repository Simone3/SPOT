import { useState } from 'react';
import FreeSelectInput from '../inputs/FreeSelectInput';
import TextArea from '../inputs/TextArea';
import './TaskFormModal.css';
import DatePicker from '../inputs/DatePicker';
import ButtonsSelect from '../inputs/ButtonsSelect';

const TaskFormModal = ({ initialTask, onSave, onDiscard, onDelete }) => {
	const [ text, setText ] = useState('');
	const [ owner, setOwner ] = useState('');
	const [ dueDate, setDueDate ] = useState('');
	const [ priority, setPriority ] = useState('HIGH');

	return (
		<div className='task-form-modal-background'>
			<div className='task-form-modal-content'>
				<h3 className='task-form-title'>Add Task</h3>
				<TextArea placeholder={'Task content...'} value={text} onChange={setText}/>
				<FreeSelectInput placeholder='No owner (me)' value={owner} onChange={setOwner} options={[ 'Some Guy', 'Somebody', 'That Guy', 'Someone' ]}/>
				<DatePicker value={dueDate} onChange={setDueDate}/>
				<ButtonsSelect
					allowMultiSelect={false}
					options={[
						{ key: 'URGENT', label: 'Urgent', color: 'var(--colors-priority-urgent-faded)' },
						{ key: 'HIGH', label: 'High', color: 'var(--colors-priority-high-faded)' },
						{ key: 'NORMAL', label: 'Normal', color: 'var(--colors-priority-normal-faded)' },
						{ key: 'LOW', label: 'Low', color: 'var(--colors-priority-low-faded)' }
					]}
					selected={priority}
					setSelected={setPriority}
				/>
				<button onClick={onSave}>Save</button>
				<button onClick={onDiscard}>Discard</button>
				<button onClick={onDelete}>Delete</button>
			</div>
		</div>
	);
};

export default TaskFormModal;
