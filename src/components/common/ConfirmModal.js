import './ConfirmModal.css';
import Button from '../inputs/Button';

const ConfirmModal = ({ title, content, confirmText, onConfirm, cancelText, onCancel }) => {

	return (
		<div className='confirm-modal-background' onClick={onCancel}>
			<div className='confirm-modal' onClick={(event) => event.stopPropagation()}>
                <h3 className='confirm-modal-title'>{title}</h3>
                <div className='confirm-modal-content'>{content}</div>
                <div className='confirm-modal-buttons'>
                    <Button className='confirm-modal-button-cancel' onClick={onCancel} label={cancelText}/>
                    <Button className='confirm-modal-button-confirm' onClick={onConfirm} label={confirmText}/>
                </div>
			</div>
		</div>
	);
};

export default ConfirmModal;
