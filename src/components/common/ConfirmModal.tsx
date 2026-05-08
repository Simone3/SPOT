import 'src/components/common/ConfirmModal.css';
import type { ReactElement } from 'react';
import { Button } from 'src/components/inputs/Button';

type ConfirmModalProps = {
	title: string;
	content: string;
	confirmText: string;
	onConfirm: () => void;
	cancelText: string;
	onCancel: () => void;
};

const ConfirmModal = ({ title, content, confirmText, onConfirm, cancelText, onCancel }: ConfirmModalProps): ReactElement => {
	return (
		<div className='confirm-modal-background' onClick={onCancel}>
			<div className='confirm-modal' onClick={(event) => {
				return event.stopPropagation();
			}}>
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

export { ConfirmModal };
