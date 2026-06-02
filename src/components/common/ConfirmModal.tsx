import 'src/components/common/ConfirmModal.css';
import { useId, type ReactElement, type ReactNode } from 'react';
import { Button } from 'src/components/inputs/Button';
import { WarningIcon } from 'src/components/icons/WarningIcon';

type ConfirmModalProps = {
	title: string;
	content: ReactNode;
	confirmText: string;
	onConfirm: () => void;
	cancelText: string;
	onCancel: () => void;
};

const ConfirmModal = ({ title, content, confirmText, onConfirm, cancelText, onCancel }: ConfirmModalProps): ReactElement => {
	const titleId = useId();
	const contentId = useId();

	return (
		<div className='confirm-modal-background' onClick={onCancel}>
			<div
				className='confirm-modal'
				role='dialog'
				aria-modal='true'
				aria-labelledby={titleId}
				aria-describedby={contentId}
				onClick={(event) => {
					return event.stopPropagation();
				}}>
				<div className='confirm-modal-heading'>
					<div className='confirm-modal-icon' aria-hidden='true'>
						<WarningIcon className='confirm-modal-warning-icon'/>
					</div>
					<h3 id={titleId} className='confirm-modal-title'>{title}</h3>
				</div>
				<div id={contentId} className='confirm-modal-content'>{content}</div>
				<div className='confirm-modal-buttons'>
					<Button className='confirm-modal-button-cancel' onClick={onCancel} label={cancelText}/>
					<Button className='confirm-modal-button-confirm' onClick={onConfirm} label={confirmText}/>
				</div>
			</div>
		</div>
	);
};

export { ConfirmModal };
