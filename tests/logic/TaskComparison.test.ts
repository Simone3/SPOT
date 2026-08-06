import { makeTask } from '../testUtils';
import { createPersistedTaskChange, getDifferingPersistedTaskFieldNames, hasPersistedTaskChange, taskToPersistedTask } from 'src/logic/TaskComparison';

describe('TaskComparison', () => {
	test('drops the runtime-only fields and the empty tags a task is never stored with', () => {
		const task = makeTask({
			tags: [ 'work', '', 'home' ],
			visible: true
		});

		const persistedTask = taskToPersistedTask(task);

		expect(persistedTask).not.toHaveProperty('visible');
		expect(persistedTask.tags).toEqual([ 'work', 'home' ]);
	});

	test('normalizes an emptied optional field to the undefined the database reads back', () => {
		const persistedTask = taskToPersistedTask(makeTask({
			owner: '',
			dueDate: ''
		}));

		expect(persistedTask.owner).toBeUndefined();
		expect(persistedTask.dueDate).toBeUndefined();
	});

	test('does not report a change when a task is only different in ways that are never stored', () => {
		const storedTask = makeTask({
			owner: undefined,
			tags: [ 'work' ],
			visible: false
		});
		const shownTask = {
			...storedTask,
			owner: '',
			tags: [ 'work', '' ],
			visible: true
		};

		const change = createPersistedTaskChange(storedTask, shownTask);

		expect(hasPersistedTaskChange(change)).toBe(false);
		expect(getDifferingPersistedTaskFieldNames(storedTask, shownTask)).toEqual([]);
	});

	test('reports a cleared optional field as an undefined value, so that it is stored as NULL', () => {
		const storedTask = makeTask({ owner: 'Alice' });
		const shownTask = {
			...storedTask,
			owner: ''
		};

		const change = createPersistedTaskChange(storedTask, shownTask);

		expect(hasPersistedTaskChange(change)).toBe(true);
		expect(Object.prototype.hasOwnProperty.call(change, 'owner')).toBe(true);
		expect(change.owner).toBeUndefined();
	});

	test('compares dates by their instant and tags by their contents', () => {
		const storedTask = makeTask({
			tags: [ 'work' ],
			completionDate: new Date('2026-05-01T10:00:00.000Z')
		});
		const sameTask = {
			...storedTask,
			tags: [ 'work' ],
			completionDate: new Date('2026-05-01T10:00:00.000Z')
		};
		const changedTask = {
			...storedTask,
			tags: [ 'work', 'home' ],
			completionDate: new Date('2026-05-02T10:00:00.000Z')
		};

		expect(getDifferingPersistedTaskFieldNames(storedTask, sameTask)).toEqual([]);
		expect(getDifferingPersistedTaskFieldNames(storedTask, changedTask)).toEqual([ 'tags', 'completionDate' ]);
	});

	test('lists every persisted field two tasks disagree on', () => {
		const storedTask = makeTask({
			text: 'Old',
			priority: 'NORMAL',
			sortPosition: 100
		});
		const shownTask = {
			...storedTask,
			text: 'New',
			priority: 'URGENT' as const,
			sortPosition: 200
		};

		expect(getDifferingPersistedTaskFieldNames(storedTask, shownTask)).toEqual([ 'text', 'priority', 'sortPosition' ]);
	});
});
