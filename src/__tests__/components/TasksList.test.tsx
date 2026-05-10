import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TasksList } from 'src/components/tasks/TasksList';
import { makeFormDomains, makeTask } from 'src/testUtils/TaskTestFactory';
import type { Task } from 'src/types/TaskTypes';

jest.mock('src/components/inputs/TextArea', () => {
	type MockTextAreaProps = {
		placeholder?: string;
		value: string;
		onChange: (value: string) => void;
		onBlur: () => void;
	};

	const MockTextArea = ({ placeholder, value, onChange, onBlur }: MockTextAreaProps): ReactElement => {
		const React = jest.requireActual('react') as typeof import('react');

		return React.createElement('textarea', {
			'aria-label': placeholder || 'Task text',
			value,
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
		useSortable: () => {
			return {
				ref: () => {},
				handleRef: () => {}
			};
		}
	};
});

const renderTasksList = (tasks: Task[]) => {
	const props = {
		title: 'Tasks',
		tasks,
		inputDomains: makeFormDomains(),
		onRefreshTasks: jest.fn(),
		onMoveTask: jest.fn(),
		onSortTasksByImportance: jest.fn(),
		onAddNewTask: jest.fn(),
		onUpdateTask: jest.fn(),
		onDeleteTask: jest.fn(),
		showActions: true
	};

	const rendered = render(<TasksList {...props}/>);

	return {
		...rendered,
		props
	};
};

describe('TasksList', () => {
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

		fireEvent.click(screen.getByText('Refresh'));
		fireEvent.click(screen.getByText('Sort by importance'));
		fireEvent.click(screen.getByText('Add task'));

		expect(props.onRefreshTasks).toHaveBeenCalledTimes(1);
		expect(props.onSortTasksByImportance).toHaveBeenCalledTimes(1);
		expect(props.onAddNewTask).toHaveBeenCalledTimes(1);
	});

	test('saves task edits, completes tasks, and confirms deletion', async() => {
		const task = makeTask({
			text: 'Original task',
			visible: true
		});
		const { container, props } = renderTasksList([ task ]);

		const taskText = screen.getByLabelText('Add content...');
		fireEvent.change(taskText, {
			target: {
				value: 'Updated task'
			}
		});
		fireEvent.blur(taskText);

		expect(props.onUpdateTask).toHaveBeenCalledWith(task, { text: 'Updated task' });
		props.onUpdateTask.mockClear();

		fireEvent.click(screen.getByRole('checkbox'));

		await waitFor(() => {
			expect(props.onUpdateTask).toHaveBeenCalledWith(task, { state: 'COMPLETED' });
		});

		const deleteAction = container.querySelector('.task-actions .clickable');
		if(!deleteAction) {
			throw Error('Delete action not found');
		}

		fireEvent.click(deleteAction);
		fireEvent.click(screen.getByRole('button', { name: 'Delete Task' }));

		expect(props.onDeleteTask).toHaveBeenCalledWith(task);
	});
});
