/**
 * What the widths of a split page allow, measured from the page itself.
 */
export type PaneSplitLimits = {

	// The width the two panes share, meaning the container width without the divider
	resizableWidthPixels: number;

	// The width the first pane needs to show what it holds: it is collapsed entirely rather than shown narrower than this
	firstPaneMinimumWidthPixels: number;

	// The width the second pane needs to show what it holds: the first pane never grows past what that leaves
	secondPaneMinimumWidthPixels: number;
};

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
 * Keeps a pane fraction inside what the layout allows: a first pane narrower than what it needs is collapsed entirely instead
 * of being left showing half of itself, and it never grows past what the second pane needs.
 * @param fraction Share of the resizable width the first pane would take.
 * @param limits What the measured widths of the page allow.
 * @returns The share the first pane may actually take.
 */
export const clampPaneFraction = (fraction: number, limits: PaneSplitLimits): number => {
	const { resizableWidthPixels, firstPaneMinimumWidthPixels, secondPaneMinimumWidthPixels } = limits;
	const wantedFraction = clampToUnitRange(fraction);

	// Nothing can be said about the widths of a page that has not been laid out yet, so the wanted share is taken as it is
	if(resizableWidthPixels <= 0) {
		return wantedFraction;
	}

	// Rounded to whole pixels, which is what the pane is drawn on anyway: a share carried back and forth through a share of a
	// width would otherwise land a fraction of a pixel under a limit and collapse a pane the user dragged exactly onto it
	const wantedWidthPixels = Math.round(wantedFraction * resizableWidthPixels);
	const maximumWidthPixels = resizableWidthPixels - secondPaneMinimumWidthPixels;

	// The second branch is a page too narrow to hold both panes, where the first one is the one that gives way
	if(wantedWidthPixels < firstPaneMinimumWidthPixels || maximumWidthPixels <= 0) {
		return 0;
	}

	if(wantedWidthPixels > maximumWidthPixels) {
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
