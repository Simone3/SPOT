import { fireEvent, render, screen, type RenderResult } from '@testing-library/react';
import { ResizablePanes } from 'src/components/common/ResizablePanes';
import { PANE_LAYOUT_CONFIG } from 'src/config/AppConfig';
import { resetPaneLayoutForTests } from 'src/logic/PaneLayout';

const containerWidthPixels = 908;
const dividerWidthPixels = 8;

// The two panes share everything the divider leaves them, which is what a pane share is a share of
const resizableWidthPixels = containerWidthPixels - dividerWidthPixels;

const defaultFraction = 1 / 3;

// jsdom lays nothing out, so the widths the divider measures are the ones the test gives it
const setElementWidth = (element: Element, width: number): void => {
	element.getBoundingClientRect = () => {
		return new DOMRect(0, 0, width, 0);
	};
};

const renderResizablePanes = (): RenderResult => {
	const result = render(
		<ResizablePanes
			layoutId='test-layout'
			defaultFirstPaneFraction={defaultFraction}
			dividerLabel='Resize the first pane'
			firstPane={<div>First pane</div>}
			secondPane={<div>Second pane</div>}
		/>
	);

	setElementWidth(result.container.querySelector('.page')!, containerWidthPixels);
	setElementWidth(screen.getByRole('separator'), dividerWidthPixels);

	return result;
};

const getDivider = (): HTMLElement => {
	return screen.getByRole('separator', { name: 'Resize the first pane' });
};

const getFirstPane = (): HTMLElement => {
	return screen.getByText('First pane').parentElement!;
};

const dragDividerBy = (deltaPixels: number): void => {
	fireEvent.mouseDown(getDivider(), { button: 0, clientX: 300 });
	fireEvent.mouseMove(window, { clientX: 300 + deltaPixels });
	fireEvent.mouseUp(window);
};

const toPercentage = (fraction: number): string => {
	return String(Math.round(fraction * 100));
};

describe('ResizablePanes', () => {
	afterEach(() => {
		resetPaneLayoutForTests();
	});

	test('starts on the default split', () => {
		renderResizablePanes();

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction));
		expect(getFirstPane()).not.toHaveAttribute('inert');
	});

	test('resizes the panes when the divider is dragged', () => {
		renderResizablePanes();

		dragDividerBy(150);

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction + 150 / resizableWidthPixels));

		// The divider is not dragged anymore, so the pointer moving on does not resize anything
		fireEvent.mouseMove(window, { clientX: 800 });

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction + 150 / resizableWidthPixels));
	});

	test('collapses the first pane when the divider is dragged to the edge', () => {
		renderResizablePanes();

		dragDividerBy(-resizableWidthPixels);

		expect(getDivider()).toHaveAttribute('aria-valuenow', '0');

		// Nothing of a collapsed pane is reachable, so what it holds is out of the tab order while it has no width
		expect(getFirstPane()).toHaveAttribute('inert');
	});

	test('never drags the second pane away entirely', () => {
		renderResizablePanes();

		dragDividerBy(resizableWidthPixels);

		const maximumFraction = (resizableWidthPixels - PANE_LAYOUT_CONFIG.minimumPaneWidthPixels) / resizableWidthPixels;
		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(maximumFraction));
	});

	test('resizes the panes with the keyboard', () => {
		renderResizablePanes();

		fireEvent.keyDown(getDivider(), { key: 'ArrowRight' });
		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction + PANE_LAYOUT_CONFIG.keyboardStepFraction));

		fireEvent.keyDown(getDivider(), { key: 'ArrowLeft' });
		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction));

		fireEvent.keyDown(getDivider(), { key: 'Home' });
		expect(getDivider()).toHaveAttribute('aria-valuenow', '0');

		fireEvent.keyDown(getDivider(), { key: 'End' });
		const maximumFraction = (resizableWidthPixels - PANE_LAYOUT_CONFIG.minimumPaneWidthPixels) / resizableWidthPixels;
		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(maximumFraction));
	});

	test('goes back to the default split when the divider is double clicked', () => {
		renderResizablePanes();

		dragDividerBy(150);
		expect(getDivider()).not.toHaveAttribute('aria-valuenow', toPercentage(defaultFraction));

		fireEvent.doubleClick(getDivider());

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction));
	});

	test('keeps the split the user chose when the page is left and opened again', () => {
		const { unmount } = renderResizablePanes();

		dragDividerBy(150);
		unmount();

		renderResizablePanes();

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction + 150 / resizableWidthPixels));
	});
});
