import './TaskFormModal.css';
import { useState } from 'react';
import FreeSelectInput from '../inputs/FreeSelectInput';
import TextArea from '../inputs/TextArea';
import DatePicker from '../inputs/DatePicker';
import ButtonsSelect from '../inputs/ButtonsSelect';
import { DateUtils } from '../../utils/DateUtils';

const TaskFormModal = ({ initialTask, onSave, onDiscard, onDelete }) => {
	const [ text, setText ] = useState(initialTask.text || '');
	const [ owner, setOwner ] = useState(initialTask.owner || '');
	const [ dueDate, setDueDate ] = useState(DateUtils.toStandardYearMonthDay(initialTask.dueDate));
	const [ priority, setPriority ] = useState(initialTask.priority);
	const [ tags, setTags ] = useState(initialTask.tags.length === 0 ? [ '' ] : [ ...initialTask.tags, '' ]);

	const setTagValue = (index, value) => {
		const newTags = [ ...tags ];
		newTags[index] = value;
		if(newTags.findIndex((tag) => !tag || !tag.trim()) === -1) {
			newTags.push('');
		}
		setTags(newTags);
	};

	const isFormValid = text && text.trim();

	return (
		<div className='task-form-modal-background'>
			<div className='task-form-modal-content'>
				<h3 className='task-form-title'>{initialTask.id ? 'Edit Task' : 'Add Task'}</h3>
				<div className='task-form-content-line'>
					<TextArea
						label='Content'
						placeholder='Content'
						value={text}
						onChange={setText}/>
				</div>
				<div className='task-form-other-inputs-line'>
					<div className='task-form-input task-form-input-priority'>
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
					</div>
					<div className='task-form-input task-form-input-owner'>
						<FreeSelectInput
							label='Owner (optional)'
							placeholder='Owner'
							value={owner}
							onChange={setOwner}
							options={[ 'Some Guy', 'Somebody', 'That Guy', 'Someone' ]}/>
					</div>
					<div className='task-form-input task-form-input-due-date'>
						<DatePicker
							label='Due date (optional)'
							value={dueDate}
							onChange={setDueDate}/>
					</div>
				</div>
				<div className='task-form-other-inputs-line'>
					{tags.map((tag, index) =>
						<div className='task-form-input task-form-input-tag'>
							<FreeSelectInput
								label={'Tag (optional)'}
								placeholder='Tag'
								value={tag}
								onChange={(value) => setTagValue(index, value)}
								options={[ 'Some tag', 'Another tag', 'Tag', 'Here\'s another tag!' ]}/>
						</div>)}
				</div>
				<div className='task-form-buttons-line'>
					<div className='task-form-buttons'>
						<button
							className='task-form-button task-form-button-discard'
							onClick={onDiscard}>
							Discard
						</button>
						{initialTask.id &&
							<button
								className='task-form-button task-form-button-delete'
								onClick={() => {
									onDelete(initialTask.id);
								}}>
								Delete
							</button>}
					</div>
					<div className='task-form-buttons'>
						<button
							className='task-form-button task-form-button-save'
							onClick={() => {
								// TODO validate/transform data: trim, empty strings, format date, tags (remove empty + check unique), etc.
								onSave({
									id: initialTask.id,
									text: text,
									state: initialTask.state,
									priority: priority,
									owner: owner,
									dueDate: dueDate,
									tags: tags
								});
							}}
							disabled={!isFormValid}>
								Save
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TaskFormModal;
