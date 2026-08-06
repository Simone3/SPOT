import 'src/components/common/PaneDivider.css';
import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react';
import { PANE_LAYOUT_CONFIG } from 'src/config/AppConfig';
import { clampPaneFraction, type PaneSplitLimits } from 'src/logic/PaneLayout';

// While the divider is dragged the pointer is over whatever the panes hold, so the resize cursor and the selection block go on the body
const RESIZING_BODY_CLASS_NAME = 'pane-resizing';

type DragState = {
	startClientX: number;
	startFraction: number;
	limits: PaneSplitLimits;
};

type PaneDividerProps = {
	label: string;
	fraction: number;
	measureLimits: () => PaneSplitLimits;
	onFractionChange: (fraction: number) => void;
	onReset: () => void;
};

/**
 * The draggable separator between two panes of a split page.
 * It reports the share of the width the pane before it should take, and never holds that share itself, so the page decides what
 * survives a re-render.
 * @param props Divider label, current pane share, page measurements, and callbacks.
 * @returns The separator.
 */
const PaneDivider = (props: PaneDividerProps): ReactElement => {
	const { label, fraction, measureLimits, onFractionChange, onReset } = props;

	const [ dragState, setDragState ] = useState<DragState | undefined>();

	const changeFraction = (wantedFraction: number): void => {
		const limits = measureLimits();

		if(limits.resizableWidthPixels <= 0) {
			return;
		}

		onFractionChange(clampPaneFraction(wantedFraction, limits));
	};

	// The pointer leaves the divider as soon as the drag starts, so the whole window follows it until the button is released
	useEffect(() => {
		if(!dragState) {
			return undefined;
		}

		const onWindowMouseMove = (event: globalThis.MouseEvent): void => {
			const movedFraction = dragState.startFraction + (event.clientX - dragState.startClientX) / dragState.limits.resizableWidthPixels;

			onFractionChange(clampPaneFraction(movedFraction, dragState.limits));
		};

		const onWindowMouseUp = (): void => {
			setDragState(undefined);
		};

		document.body.classList.add(RESIZING_BODY_CLASS_NAME);
		window.addEventListener('mousemove', onWindowMouseMove);
		window.addEventListener('mouseup', onWindowMouseUp);

		return () => {
			document.body.classList.remove(RESIZING_BODY_CLASS_NAME);
			window.removeEventListener('mousemove', onWindowMouseMove);
			window.removeEventListener('mouseup', onWindowMouseUp);
		};
	}, [ dragState, onFractionChange ]);

	const onMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
		const limits = measureLimits();

		if(event.button !== 0 || limits.resizableWidthPixels <= 0) {
			return;
		}

		// Without this the browser starts selecting the text of both panes as soon as the divider is dragged
		event.preventDefault();

		// The panes are measured once here: what they need does not change while they are being dragged, and neither does the width they share
		setDragState({
			startClientX: event.clientX,
			startFraction: fraction,
			limits
		});
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		switch(event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				changeFraction(fraction - PANE_LAYOUT_CONFIG.keyboardStepFraction);
				break;

			case 'ArrowRight':
				event.preventDefault();
				changeFraction(fraction + PANE_LAYOUT_CONFIG.keyboardStepFraction);
				break;

			case 'Home':
				event.preventDefault();
				onFractionChange(0);
				break;

			case 'End':
				event.preventDefault();
				changeFraction(1);
				break;

			default:
				break;
		}
	};

	return (
		<div
			className={`pane-divider ${dragState ? 'pane-divider-dragging' : ''}`}
			role='separator'
			aria-orientation='vertical'
			aria-label={label}
			aria-valuenow={Math.round(fraction * 100)}
			aria-valuemin={0}
			aria-valuemax={100}
			tabIndex={0}
			onMouseDown={onMouseDown}
			onDoubleClick={onReset}
			onKeyDown={onKeyDown}
		/>
	);
};

export { PaneDivider };
