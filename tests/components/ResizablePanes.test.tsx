import { fireEvent, render, screen, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Header } from 'src/components/common/Header';
import { ResizablePanes } from 'src/components/common/ResizablePanes';
import { PANE_LAYOUT_CONFIG } from 'src/config/AppConfig';
import { resetPaneLayoutForTests } from 'src/logic/PaneLayout';

// The two panes are the whole page as far as the divider is concerned, so their widths are the width the split shares out
const firstPaneWidthPixels = 300;
const secondPaneWidthPixels = 600;
const resizableWidthPixels = firstPaneWidthPixels + secondPaneWidthPixels;

const defaultFraction = 1 / 3;

// jsdom lays nothing out, so every width the panes are measured on is the one the test gives them
const setElementWidth = (element: Element, width: number): void => {
	element.getBoundingClientRect = () => {
		return new DOMRect(0, 0, width, 0);
	};
};

const setPaneWidths = (result: RenderResult, firstWidth: number, secondWidth: number): void => {
	const panes = result.container.querySelectorAll('.pane');

	setElementWidth(panes[0], firstWidth);
	setElementWidth(panes[1], secondWidth);
};

const renderResizablePanes = (firstPane: ReactNode = <div>First pane</div>, secondPane: ReactNode = <div>Second pane</div>): RenderResult => {
	const result = render(
		<ResizablePanes
			layoutId='test-layout'
			defaultFirstPaneFraction={defaultFraction}
			dividerLabel='Resize the first pane'
			firstPane={firstPane}
			secondPane={secondPane}
		/>
	);

	setPaneWidths(result, firstPaneWidthPixels, secondPaneWidthPixels);

	return result;
};

const getDivider = (): HTMLElement => {
	return screen.getByRole('separator', { name: 'Resize the first pane' });
};

const getFirstPane = (): HTMLElement => {
	return screen.getByText('First pane').closest('.pane')!;
};

const dragDividerBy = (deltaPixels: number): void => {
	fireEvent.mouseDown(getDivider(), { button: 0, clientX: 300 });
	fireEvent.mouseMove(window, { clientX: 300 + deltaPixels });
	fireEvent.mouseUp(window);
};

const toPercentage = (fraction: number): string => {
	return String(Math.round(fraction * 100));
};

const toMaximumFraction = (secondPaneMinimumWidthPixels: number): number => {
	return (resizableWidthPixels - secondPaneMinimumWidthPixels) / resizableWidthPixels;
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

	test('collapses the first pane when the divider is dragged past what it needs', () => {
		renderResizablePanes();

		dragDividerBy(-resizableWidthPixels);

		expect(getDivider()).toHaveAttribute('aria-valuenow', '0');

		// Nothing of a collapsed pane is reachable, so what it holds is out of the tab order while it has no width
		expect(getFirstPane()).toHaveAttribute('inert');
	});

	test('never drags the second pane away entirely', () => {
		renderResizablePanes();

		dragDividerBy(resizableWidthPixels);

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(toMaximumFraction(PANE_LAYOUT_CONFIG.minimumPaneWidthPixels)));
	});

	test('keeps each pane wide enough for the header it holds', () => {
		const headerActions = [{
			id: 'reset',
			icon: null,
			label: 'Reset to default',
			onClick: () => {}
		}];
		const result = renderResizablePanes(
			<div>
				First pane
				<Header title='Filters' actions={headerActions}/>
			</div>,
			<div>
				Second pane
				<Header title='Tasks' actions={headerActions}/>
			</div>
		);

		// A header needs what its title and its actions need side by side, which is what the panes are then measured against
		const headerLines = result.container.querySelectorAll('.header-line');
		setElementWidth(headerLines[0].children[0], 80);
		setElementWidth(headerLines[0].children[1], 140);
		setElementWidth(headerLines[1].children[0], 80);
		setElementWidth(headerLines[1].children[1], 320);

		// The filters header needs 220, so the pane is still shown at exactly that width
		dragDividerBy(220 - firstPaneWidthPixels);
		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(220 / resizableWidthPixels));

		// One pixel narrower is a pane that cannot show its own heading anymore, so it collapses instead
		dragDividerBy(-1);
		expect(getDivider()).toHaveAttribute('aria-valuenow', '0');

		// The tasks header is wider than the fallback minimum, so it is what stops the filters pane from growing
		dragDividerBy(resizableWidthPixels);
		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(toMaximumFraction(400)));
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
		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(toMaximumFraction(PANE_LAYOUT_CONFIG.minimumPaneWidthPixels)));
	});

	test('goes back to the default split when the divider is double clicked', () => {
		renderResizablePanes();

		dragDividerBy(150);
		expect(getDivider()).not.toHaveAttribute('aria-valuenow', toPercentage(defaultFraction));

		fireEvent.doubleClick(getDivider());

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction));
	});

	test('gives the panes back the width they need when the window becomes narrower', () => {
		const result = renderResizablePanes();

		dragDividerBy(resizableWidthPixels);
		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(toMaximumFraction(PANE_LAYOUT_CONFIG.minimumPaneWidthPixels)));

		// The split is a proportion, so a narrower window leaves the second pane on a width it cannot work with
		setPaneWidths(result, 250, 50);
		fireEvent(window, new Event('resize'));

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage((300 - PANE_LAYOUT_CONFIG.minimumPaneWidthPixels) / 300));
	});

	test('keeps the split the user chose when the page is left and opened again', () => {
		const { unmount } = renderResizablePanes();

		dragDividerBy(150);
		unmount();

		renderResizablePanes();

		expect(getDivider()).toHaveAttribute('aria-valuenow', toPercentage(defaultFraction + 150 / resizableWidthPixels));
	});
});
