import type { ReactElement } from 'react';
import type { IconProps } from 'src/components/icons/IconTypes';

/**
 * Simple six-dot drag grip icon.
 * @param props Icon display options.
 * @returns The drag handle icon SVG.
 */
const DragHandleIcon = (props: IconProps): ReactElement => {
	const { className, style } = props;

	return (
		<svg viewBox='0 0 24 24' className={className} style={style}>
			<circle cx='9' cy='5' r='1.6' fill='currentColor'/>
			<circle cx='15' cy='5' r='1.6' fill='currentColor'/>
			<circle cx='9' cy='12' r='1.6' fill='currentColor'/>
			<circle cx='15' cy='12' r='1.6' fill='currentColor'/>
			<circle cx='9' cy='19' r='1.6' fill='currentColor'/>
			<circle cx='15' cy='19' r='1.6' fill='currentColor'/>
		</svg>
	);
};

export { DragHandleIcon };
