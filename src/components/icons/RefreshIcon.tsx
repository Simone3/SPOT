import type { ReactElement } from 'react';
import type { IconProps } from 'src/components/icons/IconTypes';

/**
 * https://www.svgrepo.com/svg/533702/refresh-cw-alt
 * COLLECTION: Dazzle Line Icons
 * LICENSE: CC Attribution License
 * AUTHOR: Dazzle UI
 * @param props Icon display options.
 * @returns The refresh icon SVG.
 */
const RefreshIcon = (props: IconProps): ReactElement => {
	const { className } = props;

	return (
		<svg viewBox='0 0 24 24' fill='none' className={className}>
			<path d='M21 12C21 16.9706 16.9706 21 12 21C9.69494 21 7.59227 20.1334 6 18.7083L3 16M3 12C3 7.02944 7.02944 3 12 3C14.3051 3 16.4077 3.86656 18 5.29168L21 8M3 21V16M3 16H8M21 3V8M21 8H16' stroke='currentColor' strokeWidth='1.25' strokeLinecap='round' strokeLinejoin='round'/>
		</svg>
	);
};

export { RefreshIcon };
