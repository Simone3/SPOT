import type { ReactElement } from 'react';
import type { IconProps } from 'src/components/icons/IconTypes';

/**
 * Simple three-dot vertical overflow icon.
 * @param props Icon display options.
 * @returns The overflow menu icon SVG.
 */
const MoreVerticalIcon = (props: IconProps): ReactElement => {
	const { className, style } = props;

	return (
		<svg viewBox='0 0 24 24' className={className} style={style}>
			<circle cx='12' cy='5' r='1.8' fill='currentColor'/>
			<circle cx='12' cy='12' r='1.8' fill='currentColor'/>
			<circle cx='12' cy='19' r='1.8' fill='currentColor'/>
		</svg>
	);
};

export { MoreVerticalIcon };
