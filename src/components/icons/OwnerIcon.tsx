import type { ReactElement } from 'react';
import type { IconProps } from 'src/components/icons/IconTypes';

/**
 * https://www.svgrepo.com/svg/447734/person-male
 * COLLECTION: Forge Line Interface Icons
 * LICENSE: PD License
 * AUTHOR: theforgesmith
 * @param props Icon display options.
 * @returns The owner icon SVG.
 */
const OwnerIcon = (props: IconProps): ReactElement => {
	const { className } = props;

	return (
		<svg viewBox='0 0 64 64' strokeWidth='3' stroke='currentColor' fill='none' className={className}>
			<circle cx='32' cy='18.14' r='11.14' />
			<path d='M54.55,56.85A22.55,22.55,0,0,0,32,34.3h0A22.55,22.55,0,0,0,9.45,56.85Z' />
		</svg>
	);
};

export { OwnerIcon };
