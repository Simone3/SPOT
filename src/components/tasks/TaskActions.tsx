import 'src/components/tasks/TaskActions.css';
import { useState, type ReactElement, type ReactNode } from 'react';
import { Checkbox } from 'src/components/inputs/Checkbox';
import { DeleteIcon } from 'src/components/icons/DeleteIcon';
import { ConfirmModal } from 'src/components/common/ConfirmModal';
import type { Task } from 'src/types/TaskTypes';
import { Clickable } from 'src/components/common/Clickable';
import { useTranslator } from 'src/i18n/TranslationContext';

type TaskActionsProps = {
	task: Task;
	onChangeState: () => void;
	onDelete: () => void;
	dragHandle?: ReactNode;
	disableSecondaryActions?: boolean;
};

const TaskActions = ({ task, onChangeState, onDelete, dragHandle, disableSecondaryActions }: TaskActionsProps): ReactElement => {
	const { t } = useTranslator();
	const {
		state
	} = task;

	const [ confirmOpen, setConfirmOpen ] = useState(false);

	return (
		<div className='task-actions'>
			{dragHandle}
			<Checkbox
				value={state === 'COMPLETED'}
				onChange={onChangeState}/>
			<Clickable className='delete-button' label={t('tasks.actions.delete')} disabled={disableSecondaryActions} onClick={() => {
				setConfirmOpen(true);
			}}>
				<DeleteIcon/>
			</Clickable>
			{confirmOpen &&
				<ConfirmModal
					title={t('tasks.delete.title')}
					content={
						<>
							<p>{t('tasks.delete.permanentWarning')}</p>
							<p>{t('tasks.delete.irreversibleWarning')}</p>
						</>
					}
					confirmText={t('tasks.delete.confirm')}
					onConfirm={onDelete}
					cancelText={t('tasks.delete.cancel')}
					onCancel={() => {
						setConfirmOpen(false);
					}}
				/>
			}
		</div>
	);
};

export { TaskActions };
