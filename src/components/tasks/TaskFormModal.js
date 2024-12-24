import TextArea from '../common/TextArea';
import './TaskFormModal.css';

const TaskFormModal = ({ initialTask, onSubmit }) => {
	return (
		<div className='task-form-modal-background' onClick={onSubmit}>
			<div className='task-form-modal-content' onClick={(e) => e.stopPropagation()}>
				<h3 className='task-form-title'>Add Task</h3>
				<TextArea placeholder={'Task content...'}/>
			</div>
		</div>
	);
};

export default TaskFormModal;
