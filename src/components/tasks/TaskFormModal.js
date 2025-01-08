import './TaskFormModal.css';
import { useContext, useEffect, useRef, useState } from 'react';
import { useDetectClickOutside } from 'react-detect-click-outside';
import FreeSelectInput from '../inputs/FreeSelectInput';
import TextArea from '../inputs/TextArea';
import DatePicker from '../inputs/DatePicker';
import ButtonsSelect from '../inputs/ButtonsSelect';
import { DateUtils } from '../../utils/DateUtils';
import { ClickOutsideContext } from '../../contexts/ClickOutsideContext';
import DeleteIcon from '../icons/DeleteIcon';
import Clickable from '../common/Clickable';

const TaskFormModal = ({ initialTask, onSave, onDiscard, onDelete }) => {
	const [ text, setText ] = useState(initialTask.text || '');
	const [ owner, setOwner ] = useState(initialTask.owner || '');
	const [ dueDate, setDueDate ] = useState(initialTask.dueDate ? DateUtils.toStandardYearMonthDay(initialTask.dueDate) : '');
	const [ priority, setPriority ] = useState(initialTask.priority);
	const [ tags, setTags ] = useState(initialTask.tags.length === 0 ? [ '' ] : [ ...initialTask.tags, '' ]);
	
	const [ showDeleteConfirmation, setShowDeleteConfirmation ] = useState(false);
	const [ submitErrorInvalid, setSubmitErrorInvalid ] = useState(false);

	const setTagValue = (index, value) => {
		const newTags = [ ...tags ];
		newTags[index] = value;
		if(newTags.findIndex((tag) => !tag || !tag.trim()) === -1) {
			newTags.push('');
		}
		setTags(newTags);
	};

	// Form validation
	const isTextValid = Boolean(text && text.trim());
	const isFormValid = isTextValid;

	// Update counter in the global context when this component opens/closes
	const clickOutsideOpenCounterRef = useContext(ClickOutsideContext);
	useEffect(() => {
		clickOutsideOpenCounterRef.current += 1;
		return () => {
			clickOutsideOpenCounterRef.current -= 1;
		};
	}, [ clickOutsideOpenCounterRef ]);

	const doSave = () => {
		if(isFormValid) {
			// Form is valid: save task (add or edit)
			onSave({
				id: initialTask.id,
				text: text,
				state: initialTask.state,
				priority: priority,
				owner: owner,
				dueDate: dueDate,
				tags: tags
			});
		}
		else if(!initialTask.id) {
			// Form is invalid and the user is adding a new task: just discard [this works for now because the task text is the only validated component]
			onDiscard();
		}
		else if(!submitErrorInvalid) {
			// Form is invalid and the user is updating an existing task: show input errors
			setSubmitErrorInvalid(true);
		}
	};

	const doDelete = () => {
		if(initialTask.id) {
			setShowDeleteConfirmation(true);
		}
		else {
			onDiscard();
		}
	};

	const doCancelDelete = () => {
		setShowDeleteConfirmation(false);
	};

	const doConfirmDelete = () => {
		onDelete(initialTask.id);
	};

	const clickOutsideClicksCounterRef = useRef(0);

	const ref = useDetectClickOutside({
		onTriggered: (e) => {
			// Hack 1: save on click outside only after the second click, so that the edit icon click (tasks list) does not immediately trigger the form close
			if(clickOutsideClicksCounterRef.current === 0) {
				clickOutsideClicksCounterRef.current += 1;
				return;
			}

			// Hack 2: save on click outside only when the modal is the only opened component, so that an accidental FreeSelectInput dismissal does not trigger the form submit
			if(clickOutsideOpenCounterRef.current === 1) {
				console.log(e);
				doSave();
			}
		}
	});

	return (
		<div className='task-form-modal-background'>
			<div className='task-form-modal-content' ref={ref}>
				<div className='task-form-header-line'>
					<h3 className='task-form-title'>{initialTask.id ? 'Edit Task' : 'Add Task'}</h3>
					<div className='task-form-header-icons'>
						<Clickable onClick={doDelete}>
							<DeleteIcon />
						</Clickable>
						<div className={`task-delete-confirm-popover ${!showDeleteConfirmation && 'task-delete-confirm-popover-hidden'}`}>
							<div>
								Are you sure you want to delete this task?
							</div>
							<div className='task-delete-confirm-popover-buttons'>
								<Clickable onClick={doConfirmDelete}>Delete task</Clickable>
								<Clickable onClick={doCancelDelete}>Keep task</Clickable>
							</div>
						</div>
					</div>
				</div>
				<div className='task-form-text-line'>
					<TextArea
						label='Task'
						placeholder='Task'
						value={text}
						onChange={setText}
						validate={() => isTextValid}
						forceShowInvalid={submitErrorInvalid}/>
				</div>
				<div className='task-form-other-inputs-line'>
					<div className='task-form-input task-form-input-priority'>
						<ButtonsSelect
							label='Priority'
							allowMultiSelect={false}
							options={[
								{ key: 'URGENT', label: 'Urgent', color: 'var(--colors-priority-urgent)' },
								{ key: 'HIGH', label: 'High', color: 'var(--colors-priority-high)' },
								{ key: 'NORMAL', label: 'Normal', color: 'var(--colors-priority-normal)' },
								{ key: 'LOW', label: 'Low', color: 'var(--colors-priority-low)' }
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
						<div key={`tag-input-${index}`} className='task-form-input task-form-input-tag'>
							<FreeSelectInput
								label={'Tag (optional)'}
								placeholder='Tag'
								value={tag}
								onChange={(value) => setTagValue(index, value)}
								options={[ 'Some tag', 'Another tag', 'Tag', 'Here\'s another tag!' ]}/>
						</div>)}
				</div>
			</div>
		</div>
	);
};

export default TaskFormModal;
