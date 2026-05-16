import 'src/components/tasks/TaskActions.css';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Checkbox } from 'src/components/inputs/Checkbox';
import { DeleteIcon } from 'src/components/icons/DeleteIcon';
import { MoreVerticalIcon } from 'src/components/icons/MoreVerticalIcon';
import { ConfirmModal } from 'src/components/common/ConfirmModal';
import type { Task } from 'src/types/TaskTypes';

type TaskActionsProps = {
	task: Task;
	onChangeState: () => void;
	onDelete: () => void;
	dragHandle?: ReactNode;
};

const TaskActions = ({ task, onChangeState, onDelete, dragHandle }: TaskActionsProps): ReactElement => {
	const {
		state
	} = task;

	const [ confirmOpen, setConfirmOpen ] = useState(false);
	const [ menuOpen, setMenuOpen ] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if(!menuOpen) {
			return;
		}

		const closeMenuFromClick = (event: MouseEvent): void => {
			if(menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setMenuOpen(false);
			}
		};

		const closeMenuFromKeyboard = (event: KeyboardEvent): void => {
			if(event.key === 'Escape') {
				setMenuOpen(false);
			}
		};

		document.addEventListener('mousedown', closeMenuFromClick);
		document.addEventListener('keydown', closeMenuFromKeyboard);

		return () => {
			document.removeEventListener('mousedown', closeMenuFromClick);
			document.removeEventListener('keydown', closeMenuFromKeyboard);
		};
	}, [ menuOpen ]);

	return (
		<div className='task-actions'>
			<div className='task-actions-main'>
				<Checkbox
					value={state === 'COMPLETED'}
					onChange={onChangeState}/>
				{dragHandle}
			</div>
			<div className='task-actions-menu-container' ref={menuRef}>
				<button
					type='button'
					className='task-actions-menu-button'
					aria-label='Task actions'
					aria-haspopup='menu'
					aria-expanded={menuOpen}
					onClick={() => {
						setMenuOpen((currentMenuOpen) => {
							return !currentMenuOpen;
						});
					}}>
					<MoreVerticalIcon/>
				</button>
				{menuOpen &&
					<div className='task-actions-menu' role='menu'>
						<button
							type='button'
							className='task-actions-menu-item task-actions-menu-item-danger'
							role='menuitem'
							onClick={() => {
								setMenuOpen(false);
								setConfirmOpen(true);
							}}>
							<DeleteIcon/>
							<span>Delete</span>
						</button>
					</div>
				}
			</div>
			{confirmOpen &&
				<ConfirmModal
					title='Delete Task?'
					content='This action cannot be undone.'
					confirmText='Delete Task'
					onConfirm={onDelete}
					cancelText='Keep Task'
					onCancel={() => {
						setConfirmOpen(false);
					}}
				/>
			}
		</div>
	);
};

export { TaskActions };
