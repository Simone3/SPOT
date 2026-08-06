import { clampPaneFraction, getPaneFraction, resetPaneLayoutForTests, setPaneFraction, subscribeToPaneFraction, type PaneSplitLimits } from 'src/logic/PaneLayout';

const makeLimits = (limits: Partial<PaneSplitLimits> = {}): PaneSplitLimits => {
	return {
		resizableWidthPixels: 900,
		firstPaneMinimumWidthPixels: 200,
		secondPaneMinimumWidthPixels: 400,
		...limits
	};
};

describe('PaneLayout', () => {
	afterEach(() => {
		resetPaneLayoutForTests();
	});

	test('leaves a pane share the layout allows as it is', () => {
		expect(clampPaneFraction(0.5, makeLimits())).toBe(0.5);
	});

	test('never shrinks the first pane below what it needs', () => {
		expect(clampPaneFraction(199 / 900, makeLimits())).toBe(200 / 900);
		expect(clampPaneFraction(0, makeLimits())).toBe(200 / 900);
		expect(clampPaneFraction(-0.5, makeLimits())).toBe(200 / 900);

		// A pane dragged exactly onto the width it needs is left where the user put it
		expect(clampPaneFraction(200 / 900, makeLimits())).toBe(200 / 900);
	});

	test('never grows the first pane past what the second pane needs', () => {
		expect(clampPaneFraction(1, makeLimits())).toBe(500 / 900);
		expect(clampPaneFraction(0.99, makeLimits())).toBe(500 / 900);
	});

	test('gives what width there is to the second pane when the page is too narrow for both', () => {
		expect(clampPaneFraction(0.5, makeLimits({ resizableWidthPixels: 500 }))).toBe(100 / 500);
		expect(clampPaneFraction(0.5, makeLimits({ resizableWidthPixels: 300 }))).toBe(0);
	});

	test('takes the wanted share as it is when the page has no width yet', () => {
		expect(clampPaneFraction(0.25, makeLimits({ resizableWidthPixels: 0 }))).toBe(0.25);
	});

	test('keeps the share of each layout separately and notifies only its subscribers', () => {
		const tasksSubscriber = vi.fn();
		const otherSubscriber = vi.fn();
		const unsubscribeFromTasks = subscribeToPaneFraction('tasks', tasksSubscriber);

		subscribeToPaneFraction('other', otherSubscriber);

		expect(getPaneFraction('tasks')).toBeUndefined();

		setPaneFraction('tasks', 0.4);

		expect(getPaneFraction('tasks')).toBe(0.4);
		expect(getPaneFraction('other')).toBeUndefined();
		expect(tasksSubscriber).toHaveBeenCalledTimes(1);
		expect(otherSubscriber).not.toHaveBeenCalled();

		// The share React reads is compared by value, so setting the same one again must not make it re-render
		setPaneFraction('tasks', 0.4);
		expect(tasksSubscriber).toHaveBeenCalledTimes(1);

		unsubscribeFromTasks();
		setPaneFraction('tasks', 0.6);

		expect(getPaneFraction('tasks')).toBe(0.6);
		expect(tasksSubscriber).toHaveBeenCalledTimes(1);
	});
});
