import { PANE_LAYOUT_CONFIG } from 'src/config/AppConfig';
import { clampPaneFraction, getPaneFraction, resetPaneLayoutForTests, setPaneFraction, subscribeToPaneFraction } from 'src/logic/PaneLayout';

const resizableWidthPixels = 900;

describe('PaneLayout', () => {
	afterEach(() => {
		resetPaneLayoutForTests();
	});

	test('leaves a pane share the layout allows as it is', () => {
		expect(clampPaneFraction(0.5, resizableWidthPixels)).toBe(0.5);
	});

	test('collapses a pane dragged below the collapse width', () => {
		const slimFraction = (PANE_LAYOUT_CONFIG.collapseWidthPixels - 1) / resizableWidthPixels;

		expect(clampPaneFraction(slimFraction, resizableWidthPixels)).toBe(0);
		expect(clampPaneFraction(-0.5, resizableWidthPixels)).toBe(0);
	});

	test('keeps the minimum width of the pane on the other side of the divider', () => {
		const maximumFraction = (resizableWidthPixels - PANE_LAYOUT_CONFIG.minimumPaneWidthPixels) / resizableWidthPixels;

		expect(clampPaneFraction(1, resizableWidthPixels)).toBe(maximumFraction);
		expect(clampPaneFraction(0.99, resizableWidthPixels)).toBe(maximumFraction);
	});

	test('collapses the pane when the container is too narrow for both panes', () => {
		expect(clampPaneFraction(0.5, PANE_LAYOUT_CONFIG.minimumPaneWidthPixels)).toBe(0);
	});

	test('takes the wanted share as it is when the container has no width yet', () => {
		expect(clampPaneFraction(0.25, 0)).toBe(0.25);
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
