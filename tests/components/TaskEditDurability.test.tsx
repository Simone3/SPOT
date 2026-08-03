import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { makeFormDomains, makeTask } from '../testUtils';
import { TasksList } from 'src/components/tasks/TasksList';
import type { Task, TaskChange } from 'src/types/TaskTypes';

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
	onUpdateTask: jest.Mock<void, [ Task, TaskChange ]>;
	onDeleteTask: jest.Mock<void, [ Task ]>;
	rerenderTasks: (nextTasks: Task[]) => void;
}

const renderTasksList = (tasks: Task[]): RenderedTasksList => {
	const onUpdateTask = jest.fn<void, [ Task, TaskChange ]>();
	const onDeleteTask = jest.fn<void, [ Task ]>();

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
				onUpdateTask={onUpdateTask}
				onDeleteTask={onDeleteTask}
				showActions={true}
			/>
		);
	};

	const { container, rerender } = render(createTasksListElement(tasks));

	return {
		container,
		onUpdateTask,
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
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test('does not send an update for a task that the user just deleted', () => {
		jest.useFakeTimers();
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { container, onUpdateTask, onDeleteTask } = renderTasksList([ task ]);

		typeTaskText('Edited and then deleted');

		const deleteButton = container.querySelector('.delete-button');
		if(!deleteButton) {
			throw Error('Delete button not found');
		}

		fireEvent.click(deleteButton);
		fireEvent.click(screen.getByRole('button', { name: 'Delete Task' }));

		expect(onDeleteTask).toHaveBeenCalledWith(task);
		expect(onUpdateTask).not.toHaveBeenCalled();

		act(() => {
			jest.advanceTimersByTime(5000);
		});

		expect(onUpdateTask).not.toHaveBeenCalled();
	});

	test('shows the task values coming from the parent state after a rejected change is reconciled', () => {
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { rerenderTasks, onUpdateTask } = renderTasksList([ task ]);

		typeTaskText('Locally edited task');
		fireEvent.blur(getTaskTextInput());

		expect(onUpdateTask).toHaveBeenCalledWith(task, { text: 'Locally edited task' });

		// The write failed and the parent reloaded the task from the database
		rerenderTasks([ makeTask({
			id: task.id,
			text: 'Original task',
			sortPosition: task.sortPosition,
			visible: true
		}) ]);

		expect(getTaskTextInput()).toHaveValue('Original task');
	});

	test('sends only the fields the user changed after the parent replaced the task', () => {
		const task = makeTask({
			text: 'Original task',
			priority: 'NORMAL',
			visible: true
		});
		const { rerenderTasks, onUpdateTask } = renderTasksList([ task ]);

		// An importance sort replaced the task object in the parent state
		const sortedTask = makeTask({
			id: task.id,
			text: 'Original task',
			priority: 'NORMAL',
			sortPosition: 5000,
			visible: true
		});
		rerenderTasks([ sortedTask ]);

		typeTaskText('Edited after the bulk update');
		fireEvent.blur(getTaskTextInput());

		expect(onUpdateTask).toHaveBeenCalledWith(sortedTask, { text: 'Edited after the bulk update' });
	});

	test('saves a tag that the user typed but never blurred before the task disappeared', () => {
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { onUpdateTask, rerenderTasks } = renderTasksList([ task ]);

		typeNewTag('urgent-tag');

		// The task is filtered out of the list without the tag input ever losing focus
		rerenderTasks([]);

		expect(onUpdateTask).toHaveBeenCalledWith(task, expect.objectContaining({
			tags: [ 'urgent-tag' ]
		}));
	});

	test('saves buffered edits when the page is being closed', () => {
		jest.useFakeTimers();
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { onUpdateTask } = renderTasksList([ task ]);

		typeTaskText('Typed right before closing the window');

		act(() => {
			window.dispatchEvent(new Event('pagehide'));
		});

		expect(onUpdateTask).toHaveBeenCalledWith(task, { text: 'Typed right before closing the window' });
	});
});
