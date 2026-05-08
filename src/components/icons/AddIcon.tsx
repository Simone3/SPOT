import type { ReactElement } from 'react';
import type { IconProps } from 'src/components/icons/IconTypes';

/**
 * https://www.svgrepo.com/svg/524226/add-circle
 * COLLECTION: Solar Linear Icons
 * LICENSE: CC Attribution License
 * AUTHOR: Solar Icons
 * @param props Icon display options.
 * @returns The add icon SVG.
 */
const AddIcon = (props: IconProps): ReactElement => {
	const { className } = props;

	return (
		<svg viewBox='0 0 24 24' fill='none' className={className}>
			<circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='1.5'/>
			<path d='M15 12L12 12M12 12L9 12M12 12L12 9M12 12L12 15' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'/>
		</svg>
	);
};

export { AddIcon };
