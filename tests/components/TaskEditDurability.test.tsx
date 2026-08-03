import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { makeFormDomains, makeTask } from '../testUtils';
import { TASKS_CONFIG } from 'src/config/AppConfig';
import { clearPendingTaskChanges, flushPendingTaskChanges, registerPendingTaskChangesApplier, resetPendingTaskChangesForTests, type PendingTaskChanges } from 'src/logic/PendingTaskChanges';
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

interface RenderedTasksList {
	container: HTMLElement;
	applyPendingTaskChanges: jest.Mock<void, [ string, PendingTaskChanges ]>;
	onDeleteTask: jest.Mock<void, [ Task ]>;
	rerenderTasks: (nextTasks: Task[]) => void;
}

const renderTasksList = (tasks: Task[]): RenderedTasksList => {
	const applyPendingTaskChanges = jest.fn<void, [ string, PendingTaskChanges ]>();
	const onDeleteTask = jest.fn<void, [ Task ]>();

	registerPendingTaskChangesApplier(applyPendingTaskChanges);

	const createTasksListElement = (currentTasks: Task[]): ReactElement => {
		return (
			<TasksList
				title='Tasks'
				tasks={currentTasks}
				inputDomains={makeFormDomains()}
				onRefreshTasks={jest.fn()}
				onMoveTask={jest.fn()}
				onSortTasksByImportance={jest.fn()}
				onAddNewTask={jest.fn()}
				onDeleteTask={onDeleteTask}
				showActions={true}
			/>
		);
	};

	const { container, rerender } = render(createTasksListElement(tasks));

	return {
		container,
		applyPendingTaskChanges,
		onDeleteTask,
		rerenderTasks: (nextTasks) => {
			rerender(createTasksListElement(nextTasks));
		}
	};
};

const getTaskTextInput = (): HTMLElement => {
	return screen.getByLabelText('Add content...');
};

const typeTaskText = (value: string): void => {
	fireEvent.change(getTaskTextInput(), {
		target: {
			value
		}
	});
};

const typeNewTag = (value: string): void => {
	const newTagInput = screen.getAllByPlaceholderText('Add tag...').at(-1)!;

	fireEvent.focus(newTagInput);
	fireEvent.change(newTagInput, {
		target: {
			value
		}
	});
};

describe('Task edit durability', () => {
	beforeEach(() => {
		const useSortableMock = jest.requireMock('@dnd-kit/react/sortable').useSortable as jest.Mock;

		useSortableMock.mockImplementation(() => {
			return {
				ref: () => {},
				handleRef: () => {}
			};
		});
	});

	afterEach(() => {
		resetPendingTaskChangesForTests();
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test('keeps saving what the user typed after the task disappears from the list', () => {
		jest.useFakeTimers();
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { applyPendingTaskChanges, rerenderTasks } = renderTasksList([ task ]);

		typeTaskText('Edited and then filtered out');

		// The task is filtered out while its changes are still buffered
		rerenderTasks([]);

		expect(applyPendingTaskChanges).not.toHaveBeenCalled();

		act(() => {
			jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);
		});

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Edited and then filtered out'
			},
			newTag: ''
		});
	});

	test('never saves the buffered changes of a task that was deleted', () => {
		jest.useFakeTimers();
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { container, applyPendingTaskChanges, onDeleteTask } = renderTasksList([ task ]);
		onDeleteTask.mockImplementation((deletedTask) => {
			clearPendingTaskChanges(deletedTask.id);
		});

		typeTaskText('Edited and then deleted');

		const deleteButton = container.querySelector('.delete-button');
		if(!deleteButton) {
			throw Error('Delete button not found');
		}

		fireEvent.click(deleteButton);
		fireEvent.click(screen.getByRole('button', { name: 'Delete Task' }));

		act(() => {
			jest.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);
		});
		flushPendingTaskChanges();

		expect(onDeleteTask).toHaveBeenCalledWith(task);
		expect(applyPendingTaskChanges).not.toHaveBeenCalled();
	});

	test('shows the task values coming from the parent state after a rejected change is reconciled', () => {
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { rerenderTasks, applyPendingTaskChanges } = renderTasksList([ task ]);

		typeTaskText('Locally edited task');
		fireEvent.blur(getTaskTextInput());

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Locally edited task'
			},
			newTag: ''
		});

		// The write failed and the parent reloaded the task from the database
		rerenderTasks([ makeTask({
			id: task.id,
			text: 'Original task',
			sortPosition: task.sortPosition,
			visible: true
		}) ]);

		expect(getTaskTextInput()).toHaveValue('Original task');
	});

	test('keeps showing what the user is typing while the parent replaces the task', () => {
		const task = makeTask({
			text: 'Original task',
			priority: 'NORMAL',
			visible: true
		});
		const { rerenderTasks, applyPendingTaskChanges } = renderTasksList([ task ]);

		typeTaskText('Still being typed');

		// An importance sort replaced the task object in the parent state while the user was typing
		rerenderTasks([ makeTask({
			id: task.id,
			text: 'Original task',
			priority: 'NORMAL',
			sortPosition: 5000,
			visible: true
		}) ]);

		expect(getTaskTextInput()).toHaveValue('Still being typed');

		fireEvent.blur(getTaskTextInput());

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Still being typed'
			},
			newTag: ''
		});
	});

	test('saves a tag that the user typed but never blurred before the task disappeared', () => {
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { applyPendingTaskChanges, rerenderTasks } = renderTasksList([ task ]);

		typeNewTag('urgent-tag');

		// The task is filtered out of the list without the tag input ever losing focus
		rerenderTasks([]);
		flushPendingTaskChanges();

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			change: {},
			newTag: 'urgent-tag'
		});
	});

	test('saves buffered edits when everything is flushed before the renderer goes away', () => {
		jest.useFakeTimers();
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { applyPendingTaskChanges } = renderTasksList([ task ]);

		typeTaskText('Typed right before quitting');
		flushPendingTaskChanges();

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			change: {
				text: 'Typed right before quitting'
			},
			newTag: ''
		});
	});
});
