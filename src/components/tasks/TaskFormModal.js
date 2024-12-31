import { useState } from 'react';
import FreeSelectInput from '../inputs/FreeSelectInput';
import TextArea from '../inputs/TextArea';
import './TaskFormModal.css';
import DatePicker from '../inputs/DatePicker';
import Checkbox from '../inputs/Checkbox';
import ButtonsSelect from '../inputs/ButtonsSelect';
import TextInput from '../inputs/TextInput';

const TaskFormModal = ({ initialTask, onSave, onDiscard, onDelete }) => {
	const [ text, setText ] = useState('');
	const [ owner, setOwner ] = useState('');
	const [ dueDate, setDueDate ] = useState('');
	const [ priority, setPriority ] = useState('HIGH');
	const [ tags, setTags ] = useState('');
	const [ completed, setCompleted ] = useState(false);

	return (
		<div className='task-form-modal-background'>
			<div className='task-form-modal-content'>
				<h3 className='task-form-title'>Add Task</h3>
				<TextArea
					label='Content'
					placeholder='Task content'
					value={text}
					onChange={setText}/>
				<FreeSelectInput
					label='Owner (optional)'
					placeholder='Task owner'
					value={owner}
					onChange={setOwner}
					options={[ 'Some Guy', 'Somebody', 'That Guy', 'Someone' ]}/>
				<DatePicker
					label='Due date (optional)'
					value={dueDate}
					onChange={setDueDate}/>
				<ButtonsSelect
					label='Priority'
					allowMultiSelect={false}
					options={[
						{ key: 'URGENT', label: 'Urgent', color: 'var(--colors-priority-urgent-faded)' },
						{ key: 'HIGH', label: 'High', color: 'var(--colors-priority-high-faded)' },
						{ key: 'NORMAL', label: 'Normal', color: 'var(--colors-priority-normal-faded)' },
						{ key: 'LOW', label: 'Low', color: 'var(--colors-priority-low-faded)' }
					]}
					value={priority}
					onChange={setPriority}
				/>
				<TextInput
					label='Comma-separated tags (optional)'
					placeholder='TAG1, TAG2, TAG3'
					value={tags}
					onChange={setTags}/>
				<Checkbox
					label='Completed'
					value={completed}
					onChange={setCompleted}/>
				<button onClick={onSave}>Save</button>
				<button onClick={onDiscard}>Discard</button>
				<button onClick={onDelete}>Delete</button>
			</div>
		</div>
	);
};

export default TaskFormModal;
