import type { Mock } from 'vitest';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { makeFormDomains, makeTask, renderWithTranslations } from '../testUtils';
import { registerPendingTaskChangesApplier, resetPendingTaskChangesForTests } from 'src/logic/PendingTaskChanges';
import { TasksList } from 'src/components/tasks/TasksList';
import type { Task, TaskChange } from 'src/types/TaskTypes';

vi.mock('src/components/inputs/TextArea', async() => {
	// The mock factory is hoisted above the imports, so React is loaded here rather than referenced from the module scope
	const React = await vi.importActual<typeof import('react')>('react');

	type MockTextAreaProps = {
		placeholder?: string;
		value: string;
		onChange: (value: string) => void;
		onBlur: () => void;
		disabled?: boolean;
	};

	const MockTextArea = ({ placeholder, value, onChange, onBlur, disabled }: MockTextAreaProps): ReactElement => {
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

vi.mock('@dnd-kit/react', async() => {
	// The mock factory is hoisted above the imports, so React is loaded here rather than referenced from the module scope
	const React = await vi.importActual<typeof import('react')>('react');

	const MockDragDropProvider = ({ children }: { children: ReactNode }): ReactElement => {
		return React.createElement(React.Fragment, null, children);
	};

	return {
		__esModule: true,
		DragDropProvider: MockDragDropProvider
	};
});

vi.mock('@dnd-kit/react/sortable', () => {
	return {
		__esModule: true,
		isSortable: () => {
			return false;
		},
		useSortable: vi.fn(() => {
			return {
				ref: () => {},
				handleRef: () => {}
			};
		})
	};
});

// The module above is mocked, so the imported binding is the mock itself
const getUseSortableMock = (): Mock => {
	return useSortable as unknown as Mock;
};

const renderTasksList = (tasks: Task[]) => {
	const props = {
		title: 'Tasks',
		tasks,
		inputDomains: makeFormDomains(),
		onRefreshTasks: vi.fn(),
		onMoveTask: vi.fn(),
		onSortTasksByImportance: vi.fn(),
		onAddNewTask: vi.fn(),
		onDeleteTask: vi.fn(),
		showActions: true
	};
	const applyPendingTaskChanges = vi.fn<(taskId: string, changedValues: TaskChange) => void>();

	registerPendingTaskChangesApplier(applyPendingTaskChanges);

	const rendered = renderWithTranslations(<TasksList {...props}/>);

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
		vi.useRealTimers();
		getUseSortableMock().mockClear();
		vi.restoreAllMocks();
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

	test('labels every chip input with its icon, so clicking the icon focuses the input', () => {
		const task = makeTask({
			text: 'Task with chips',
			visible: true
		});
		const { container } = renderTasksList([ task ]);

		const chipInputs = [
			screen.getByPlaceholderText('Me'),
			screen.getByPlaceholderText('No due date'),
			screen.getByPlaceholderText('Add tag...')
		];
		const chipIcons = Array.from(container.querySelectorAll('.chip-icon-left'));

		expect(chipIcons).toHaveLength(chipInputs.length);
		for(let i = 0; i < chipInputs.length; i++) {
			expect(chipInputs[i].id).toBeTruthy();
			expect(chipIcons[i]).toHaveAttribute('for', chipInputs[i].id);
		}
	});

	test('saves task edits and delays completion while disabling secondary controls', () => {
		vi.useFakeTimers();
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
			text: 'Updated task'
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
		expect(deleteButton).toBeDisabled();
		fireEvent.click(deleteButton);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
		expect(deleteButton).not.toBeDisabled();
		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(applyPendingTaskChanges).not.toHaveBeenCalled();

		fireEvent.click(completionCheckbox);

		expect(taskContainer).toHaveClass('task-container-state-changing');
		act(() => {
			vi.advanceTimersByTime(2999);
		});
		expect(applyPendingTaskChanges).not.toHaveBeenCalled();
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			state: 'COMPLETED'
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
