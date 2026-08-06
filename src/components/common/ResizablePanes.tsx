import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { HEADER_LINE_CLASS_NAME } from 'src/components/common/Header';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { PaneDivider } from 'src/components/common/PaneDivider';
import { PANE_LAYOUT_CONFIG } from 'src/config/AppConfig';
import { clampPaneFraction, getPaneFraction, setPaneFraction, subscribeToPaneFraction, type PaneSplitLimits } from 'src/logic/PaneLayout';

type ResizablePanesProps = {
	layoutId: string;
	defaultFirstPaneFraction: number;
	dividerLabel: string;
	firstPane: ReactNode;
	secondPane: ReactNode;
};

const toPixels = (styleValue: string): number => {
	const pixels = parseFloat(styleValue);

	return Number.isFinite(pixels) ? pixels : 0;
};

// What a header needs is what its own children need side by side, and never what the pane currently gives it: a pane wider than
// its header would only report its own width back, and a narrower one has already clipped what did not fit
const measureRequiredWidthPixels = (headerLine: Element): number => {
	return Array.from(headerLine.children).reduce((requiredWidthPixels, child) => {
		const childStyle = window.getComputedStyle(child);

		return requiredWidthPixels + child.getBoundingClientRect().width + toPixels(childStyle.marginLeft) + toPixels(childStyle.marginRight);
	}, 0);
};

// A pane is never squeezed below the headers it holds: a title and its actions having to newline is where a pane stops being readable,
// so that is where the divider stops
const measureMinimumWidthPixels = (pane: HTMLDivElement | null): number => {
	const headerLines = Array.from(pane?.querySelectorAll(`.${HEADER_LINE_CLASS_NAME}`) ?? []);

	return Math.max(PANE_LAYOUT_CONFIG.minimumPaneWidthPixels, ...headerLines.map(measureRequiredWidthPixels));
};

const measureWidthPixels = (pane: HTMLDivElement | null): number => {
	return pane?.getBoundingClientRect().width ?? 0;
};

/**
 * A page split into two panes the user can resize by dragging the divider between them, between the widths the two panes need.
 * The share each pane takes is kept in `src/logic/PaneLayout.ts` rather than in this component, so that navigating away from the
 * page and back does not undo the resizing.
 * @param props The layout identity, the share the first pane starts at, the divider label, and the two panes.
 * @returns The split page.
 */
const ResizablePanes = (props: ResizablePanesProps): ReactElement => {
	const { layoutId, defaultFirstPaneFraction, dividerLabel, firstPane, secondPane } = props;

	const firstPaneRef = useRef<HTMLDivElement>(null);
	const secondPaneRef = useRef<HTMLDivElement>(null);

	const subscribe = useCallback((subscriber: () => void): () => void => {
		return subscribeToPaneFraction(layoutId, subscriber);
	}, [ layoutId ]);

	const getFraction = useCallback((): number => {
		return getPaneFraction(layoutId) ?? defaultFirstPaneFraction;
	}, [ layoutId, defaultFirstPaneFraction ]);

	const firstPaneFraction = useSyncExternalStore(subscribe, getFraction);

	// The two panes are exactly what the divider leaves of the page, so nothing else has to be measured to know the width they share
	const measureLimits = useCallback((): PaneSplitLimits => {
		return {
			resizableWidthPixels: measureWidthPixels(firstPaneRef.current) + measureWidthPixels(secondPaneRef.current),
			firstPaneMinimumWidthPixels: measureMinimumWidthPixels(firstPaneRef.current),
			secondPaneMinimumWidthPixels: measureMinimumWidthPixels(secondPaneRef.current)
		};
	}, []);

	const onFractionChange = useCallback((fraction: number): void => {
		setPaneFraction(layoutId, fraction);
	}, [ layoutId ]);

	const onReset = useCallback((): void => {
		setPaneFraction(layoutId, clampPaneFraction(defaultFirstPaneFraction, measureLimits()));
	}, [ layoutId, defaultFirstPaneFraction, measureLimits ]);

	// The panes keep their proportions when the window is resized, but what they need to stay readable is a width, so a window
	// that just became narrower can leave them on a split that is not allowed anymore
	useEffect(() => {
		const onWindowResize = (): void => {
			setPaneFraction(layoutId, clampPaneFraction(getFraction(), measureLimits()));
		};

		window.addEventListener('resize', onWindowResize);

		return () => {
			window.removeEventListener('resize', onWindowResize);
		};
	}, [ layoutId, getFraction, measureLimits ]);

	// The two shares always add up to one, so the panes fill the width the divider leaves them and nothing has to be measured to render
	return (
		<Page>
			<Pane relativeSize={firstPaneFraction} ref={firstPaneRef}>
				{firstPane}
			</Pane>
			<PaneDivider
				label={dividerLabel}
				fraction={firstPaneFraction}
				measureLimits={measureLimits}
				onFractionChange={onFractionChange}
				onReset={onReset}
			/>
			<Pane relativeSize={1 - firstPaneFraction} ref={secondPaneRef}>
				{secondPane}
			</Pane>
		</Page>
	);
};

export { ResizablePanes };
