import { PANE_LAYOUT_CONFIG } from 'src/config/AppConfig';

/**
 * The share of the resizable width the user gave the first pane of each split layout.
 * It is kept out of the component tree so that leaving a page and coming back does not undo the resizing, the same way the task
 * state lives above the router. It is session state on purpose: nothing is stored, so every SPOT start opens on the default layout.
 */
const paneFractions = new Map<string, number>();

const fractionSubscribers = new Map<string, Set<() => void>>();

const clampToUnitRange = (fraction: number): number => {
	return Math.min(Math.max(fraction, 0), 1);
};

/**
 * Keeps a pane fraction inside what the layout allows: a pane narrower than the collapse width is collapsed entirely, and the
 * pane on the other side of the divider always keeps its minimum width.
 * @param fraction Share of the resizable width the first pane would take.
 * @param resizableWidthPixels Width the two panes share, meaning the container width without the divider.
 * @returns The share the first pane may actually take.
 */
export const clampPaneFraction = (fraction: number, resizableWidthPixels: number): number => {
	const wantedFraction = clampToUnitRange(fraction);

	// Nothing can be said about the widths of a container that has not been laid out yet, so the wanted share is taken as it is
	if(resizableWidthPixels <= 0) {
		return wantedFraction;
	}

	const wantedWidthPixels = wantedFraction * resizableWidthPixels;
	const maximumWidthPixels = resizableWidthPixels - PANE_LAYOUT_CONFIG.minimumPaneWidthPixels;

	if(wantedWidthPixels <= PANE_LAYOUT_CONFIG.collapseWidthPixels || maximumWidthPixels <= 0) {
		return 0;
	}

	if(wantedWidthPixels >= maximumWidthPixels) {
		return maximumWidthPixels / resizableWidthPixels;
	}

	return wantedFraction;
};

/**
 * Returns the share of the resizable width the first pane of one split layout currently takes.
 * @param layoutId Split layout to read.
 * @returns The share, or undefined when the user has not resized that layout in this session.
 */
export const getPaneFraction = (layoutId: string): number | undefined => {
	return paneFractions.get(layoutId);
};

/**
 * Sets the share of the resizable width the first pane of one split layout takes.
 * @param layoutId Split layout to resize.
 * @param fraction Share the first pane takes, already clamped to what the layout allows.
 */
export const setPaneFraction = (layoutId: string, fraction: number): void => {
	if(paneFractions.get(layoutId) === fraction) {
		return;
	}

	paneFractions.set(layoutId, fraction);
	fractionSubscribers.get(layoutId)?.forEach((subscriber) => {
		subscriber();
	});
};

/**
 * Subscribes to the pane fraction of one split layout.
 * @param layoutId Split layout to observe.
 * @param subscriber Callback invoked whenever that layout is resized.
 * @returns The callback that unsubscribes.
 */
export const subscribeToPaneFraction = (layoutId: string, subscriber: () => void): () => void => {
	const layoutSubscribers = fractionSubscribers.get(layoutId) ?? new Set<() => void>();

	layoutSubscribers.add(subscriber);
	fractionSubscribers.set(layoutId, layoutSubscribers);

	return () => {
		layoutSubscribers.delete(subscriber);

		if(layoutSubscribers.size === 0) {
			fractionSubscribers.delete(layoutId);
		}
	};
};

/**
 * Drops every stored pane fraction and subscription.
 * Only meant for tests, because the layout is shared by the whole renderer.
 */
export const resetPaneLayoutForTests = (): void => {
	paneFractions.clear();
	fractionSubscribers.clear();
};
