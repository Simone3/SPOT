import { useCallback, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { Page } from 'src/components/common/Page';
import { Pane } from 'src/components/common/Pane';
import { PaneDivider } from 'src/components/common/PaneDivider';
import { getPaneFraction, setPaneFraction, subscribeToPaneFraction } from 'src/logic/PaneLayout';

type ResizablePanesProps = {
	layoutId: string;
	defaultFirstPaneFraction: number;
	dividerLabel: string;
	firstPane: ReactNode;
	secondPane: ReactNode;
};

/**
 * A page split into two panes the user can resize by dragging the divider between them, down to collapsing the first one entirely.
 * The share each pane takes is kept in `src/logic/PaneLayout.ts` rather than in this component, so that navigating away from the
 * page and back does not undo the resizing.
 * @param props The layout identity, the share the first pane starts at, the divider label, and the two panes.
 * @returns The split page.
 */
const ResizablePanes = (props: ResizablePanesProps): ReactElement => {
	const { layoutId, defaultFirstPaneFraction, dividerLabel, firstPane, secondPane } = props;

	const containerRef = useRef<HTMLDivElement>(null);

	const subscribe = useCallback((subscriber: () => void): () => void => {
		return subscribeToPaneFraction(layoutId, subscriber);
	}, [ layoutId ]);

	const getFraction = useCallback((): number => {
		return getPaneFraction(layoutId) ?? defaultFirstPaneFraction;
	}, [ layoutId, defaultFirstPaneFraction ]);

	const firstPaneFraction = useSyncExternalStore(subscribe, getFraction);

	const onFractionChange = useCallback((fraction: number): void => {
		setPaneFraction(layoutId, fraction);
	}, [ layoutId ]);

	const onReset = useCallback((): void => {
		setPaneFraction(layoutId, defaultFirstPaneFraction);
	}, [ layoutId, defaultFirstPaneFraction ]);

	// The two shares always add up to one, so the panes fill the width the divider leaves them and nothing else has to be measured
	return (
		<Page ref={containerRef}>
			<Pane relativeSize={firstPaneFraction} inert={firstPaneFraction === 0}>
				{firstPane}
			</Pane>
			<PaneDivider
				label={dividerLabel}
				fraction={firstPaneFraction}
				containerRef={containerRef}
				onFractionChange={onFractionChange}
				onReset={onReset}
			/>
			<Pane relativeSize={1 - firstPaneFraction}>
				{secondPane}
			</Pane>
		</Page>
	);
};

export { ResizablePanes };
