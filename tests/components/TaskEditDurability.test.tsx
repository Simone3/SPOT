import type { Mock } from 'vitest';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { makeFormDomains, makeTask } from '../testUtils';
import { TASKS_CONFIG } from 'src/config/AppConfig';
import { clearPendingTaskChanges, flushPendingTaskChanges, registerPendingTaskChangesApplier, resetPendingTaskChangesForTests } from 'src/logic/PendingTaskChanges';
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

interface RenderedTasksList {
	container: HTMLElement;
	applyPendingTaskChanges: Mock<(taskId: string, changedValues: TaskChange) => void>;
	onDeleteTask: Mock<(task: Task) => void>;
	rerenderTasks: (nextTasks: Task[]) => void;
}

const renderTasksList = (tasks: Task[]): RenderedTasksList => {
	const applyPendingTaskChanges = vi.fn<(taskId: string, changedValues: TaskChange) => void>();
	const onDeleteTask = vi.fn<(task: Task) => void>();

	registerPendingTaskChangesApplier(applyPendingTaskChanges);

	const createTasksListElement = (currentTasks: Task[]): ReactElement => {
		return (
			<TasksList
				title='Tasks'
				tasks={currentTasks}
				inputDomains={makeFormDomains()}
				onRefreshTasks={vi.fn()}
				onMoveTask={vi.fn()}
				onSortTasksByImportance={vi.fn()}
				onAddNewTask={vi.fn()}
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
		// The module above is mocked, so the imported binding is the mock itself
		const useSortableMock = useSortable as unknown as Mock;

		useSortableMock.mockImplementation(() => {
			return {
				ref: () => {},
				handleRef: () => {}
			};
		});
	});

	afterEach(() => {
		resetPendingTaskChangesForTests();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	test('keeps saving what the user typed after the task disappears from the list', () => {
		vi.useFakeTimers();
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
			vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);
		});

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			text: 'Edited and then filtered out'
		});
	});

	test('never saves the buffered changes of a task that was deleted', () => {
		vi.useFakeTimers();
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
			vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);
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
			text: 'Locally edited task'
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
			text: 'Still being typed'
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
			tags: [ 'urgent-tag' ]
		});
	});

	test('does not save a tag while the user is still typing it', () => {
		vi.useFakeTimers();
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { applyPendingTaskChanges } = renderTasksList([ task ]);

		typeNewTag('half-typed');

		// Typing a tag buffers it without starting a save of its own, so half-typed tags never reach the database
		act(() => {
			vi.advanceTimersByTime(TASKS_CONFIG.flushDelayMs);
		});

		expect(applyPendingTaskChanges).not.toHaveBeenCalled();

		// The tag the user is typing keeps its own input, and an empty one is always waiting for the next tag
		const tagInputs = screen.getAllByPlaceholderText('Add tag...');

		expect(tagInputs).toHaveLength(2);
		expect(tagInputs[0]).toHaveValue('half-typed');
		expect(tagInputs[1]).toHaveValue('');
	});

	test('saves the tag the user typed when they leave its input', () => {
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { applyPendingTaskChanges } = renderTasksList([ task ]);

		typeNewTag('urgent-tag');
		fireEvent.blur(screen.getAllByPlaceholderText('Add tag...')[0]);

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			tags: [ 'urgent-tag' ]
		});
	});

	test('saves buffered edits when everything is flushed before the renderer goes away', () => {
		vi.useFakeTimers();
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { applyPendingTaskChanges } = renderTasksList([ task ]);

		typeTaskText('Typed right before quitting');
		act(() => {
			flushPendingTaskChanges();
		});

		expect(applyPendingTaskChanges).toHaveBeenCalledWith(task.id, {
			text: 'Typed right before quitting'
		});
	});
});
