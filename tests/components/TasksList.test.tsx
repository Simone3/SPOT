import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { makeFormDomains, makeTask } from '../testUtils';
import { registerPendingTaskChangesApplier, resetPendingTaskChangesForTests, type PendingTaskChanges } from 'src/logic/PendingTaskChanges';
import { TasksList } from 'src/components/tasks/TasksList';
import type { Task } from 'src/types/TaskTypes';

jest.mock('src/components/inputs/TextArea', () => {
	type MockTextAreaProps = {
		placeholder?: string;
		value: string;
		onChange: (value: string) => void;
		onBlur: () => void;
		disabled?: boolean;
	};

	const MockTextArea = ({ placeholder, value, onChange, onBlur, disabled }: MockTextAreaProps): ReactElement => {
		const React = jest.requireActual('react') as typeof import('react');

		return React.createElement('textarea', {
			'aria-label': placeholder || 'Task text',
			value,
			readOnly: disabled,
			onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
				onChange(event.target.value);
			},
			onBlur
		});
	};

	return {
		TextArea: MockTextArea
	};
});

jest.mock('@dnd-kit/react', () => {
	const MockDragDropProvider = ({ children }: { children: ReactNode }): ReactElement => {
		const React = jest.requireActual('react') as typeof import('react');

		return React.createElement(React.Fragment, null, children);
	};

	return {
		__esModule: true,
		DragDropProvider: MockDragDropProvider
	};
});

jest.mock('@dnd-kit/react/sortable', () => {
	return {
		__esModule: true,
		isSortable: () => {
			return false;
		},
		useSortable: jest.fn(() => {
			return {
				ref: () => {},
				handleRef: () => {}
			};
		})
	};
});

const getUseSortableMock = (): jest.Mock => {
	return jest.requireMock('@dnd-kit/react/sortable').useSortable as jest.Mock;
};

const renderTasksList = (tasks: Task[]) => {
	const props = {
		title: 'Tasks',
		tasks,
		inputDomains: makeFormDomains(),
		onRefreshTasks: jest.fn(),
		onMoveTask: jest.fn(),
		onSortTasksByImportance: jest.fn(),
		onAddNewTask: jest.fn(),
		onDeleteTask: jest.fn(),
		showActions: true
	};
	const applyPendingTaskChanges = jest.fn<void, [ string, PendingTaskChanges ]>();

	registerPendingTaskChangesApplier(applyPendingTaskChanges);

	const rendered = render(<TasksList {...props}/>);

	return {
		...rendered,
		props,
		applyPendingTaskChanges
	};
};

describe('TasksList', () => {
	beforeEach(() => {
		getUseSortableMock().mockImplementation(() => {
			return {
				ref: () => {},
				handleRef: () => {}
			};
		});
	});

	afterEach(() => {
		resetPendingTaskChangesForTests();
		jest.useRealTimers();
		getUseSortableMock().mockClear();
		jest.restoreAllMocks();
	});

	test('renders only visible tasks and wires list-level actions', () => {
		const visibleTask = makeTask({
			text: 'Visible task',
			visible: true
		});
		const hiddenTask = makeTask({
			text: 'Hidden task',
			visible: false
		});
		const { props } = renderTasksList([ visibleTask, hiddenTask ]);

		expect(screen.getByDisplayValue('Visible task')).toBeInTheDocument();
		expect(screen.queryByDisplayValue('Hidden task')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Drag task')).toBeInTheDocument();
		expect(screen.queryByText(/MOVE P =/)).not.toBeInTheDocument();

		fireEvent.click(screen.getByText('Refresh'));
		fireEvent.click(screen.getByText('Sort by importance'));
		fireEvent.click(screen.getByText('Add task'));

		expect(props.onRefreshTasks).toHaveBeenCalledTimes(1);
		expect(props.onSortTasksByImportance).toHaveBeenCalledTimes(1);
		expect(props.onAddNewTask).toHaveBeenCalledTimes(1);
	});

	test('saves task edits and delays completion while disabling secondary controls', () => {
		jest.useFakeTimers();
		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { container, applyPendingTaskChanges } = renderTasksList([ task ]);

		const taskText = screen.getByLabelText('Add content...');
		fireEvent.change(taskText, {
			target: {
				value: 'Updated task'
			}
		});

		const taskContainer = container.querySelector('.task-container');
		if(!taskContainer) {
			throw Error('Task container not found');
		}

		expect(applyPendingTaskChanges).not.toHaveBeenCalled();

		fireEvent.blur(taskText);

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Updated task'
			},
			newTag: ''
		});
		applyPendingTaskChanges.mockClear();

		const completionCheckbox = screen.getByRole('checkbox');
		const priorityPicker = taskContainer.querySelector('.task-priority-picker-option');
		const dragHandle = screen.getByLabelText('Drag task');
		const deleteButton = taskContainer.querySelector('.delete-button');

		if(!priorityPicker || !deleteButton) {
			throw Error('Task controls not found');
		}

		fireEvent.click(completionCheckbox);

		expect(taskContainer).toHaveClass('task-container-state-changing');
		expect(getUseSortableMock()).toHaveBeenLastCalledWith(expect.objectContaining({
			disabled: true
		}));
		expect(taskText).toHaveAttribute('readonly');
		expect(screen.getByPlaceholderText('Me')).toBeDisabled();
		expect(screen.getByPlaceholderText('No due date')).toBeDisabled();
		expect(screen.getByPlaceholderText('Add tag...')).toBeDisabled();
		expect(priorityPicker).toHaveAttribute('aria-disabled', 'true');
		expect(dragHandle).toBeDisabled();
		expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
		fireEvent.click(deleteButton);
		expect(screen.queryByRole('button', { name: 'Delete Task' })).not.toBeInTheDocument();
		expect(applyPendingTaskChanges).not.toHaveBeenCalled();

		fireEvent.click(completionCheckbox);

		expect(taskContainer).not.toHaveClass('task-container-state-changing');
		expect(getUseSortableMock()).toHaveBeenLastCalledWith(expect.objectContaining({
			disabled: false
		}));
		expect(taskText).not.toHaveAttribute('readonly');
		expect(screen.getByPlaceholderText('Me')).not.toBeDisabled();
		expect(screen.getByPlaceholderText('No due date')).not.toBeDisabled();
		expect(screen.getByPlaceholderText('Add tag...')).not.toBeDisabled();
		expect(priorityPicker).toHaveAttribute('aria-disabled', 'false');
		expect(dragHandle).not.toBeDisabled();
		expect(deleteButton).toHaveAttribute('aria-disabled', 'false');
		act(() => {
			jest.advanceTimersByTime(3000);
		});
		expect(applyPendingTaskChanges).not.toHaveBeenCalled();

		fireEvent.click(completionCheckbox);

		expect(taskContainer).toHaveClass('task-container-state-changing');
		act(() => {
			jest.advanceTimersByTime(2999);
		});
		expect(applyPendingTaskChanges).not.toHaveBeenCalled();
		act(() => {
			jest.advanceTimersByTime(1);
		});
		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			change: {
				state: 'COMPLETED'
			},
			newTag: ''
		});
		expect(consoleErrorSpy.mock.calls.some((call) => {
			return call.some((value) => {
				return String(value).includes('Cannot update a component');
			});
		})).toBe(false);
	});

	test('confirms deletion', () => {
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { container, props } = renderTasksList([ task ]);

		const taskActions = container.querySelector('.task-actions');
		if(!taskActions) {
			throw Error('Task actions not found');
		}

		expect(taskActions.children.length).toBe(3);
		expect(taskActions.children[0]).toHaveAttribute('aria-label', 'Drag task');
		expect(taskActions.children[1].querySelector('input')).toHaveAttribute('type', 'checkbox');
		expect(taskActions.children[2]).toHaveClass('clickable', 'delete-button');

		fireEvent.click(taskActions.children[2]);
		const dialog = screen.getByRole('dialog', { name: 'Delete task?' });
		expect(dialog).toBeInTheDocument();
		expect(screen.getByText('This will permanently delete this task.')).toBeInTheDocument();
		expect(dialog).not.toHaveTextContent('Original task');
		expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Keep Task' }));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		fireEvent.click(taskActions.children[2]);
		fireEvent.click(screen.getByRole('button', { name: 'Delete Task' }));

		expect(props.onDeleteTask).toHaveBeenCalledWith(task);
	});
});
