import type { IconProps } from './IconTypes';

/**
 * https://www.svgrepo.com/svg/442024/warning
 * COLLECTION: Quill Oval Interface Icons
 * LICENSE: MIT License
 * AUTHOR: yourtempo
 */
const WarningIcon = ({ className }: IconProps) => {
	return (
		<svg viewBox='0 0 32 32' fill='none' className={className}>
			<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M15.12 4.623a1 1 0 011.76 0l11.32 20.9A1 1 0 0127.321 27H4.679a1 1 0 01-.88-1.476l11.322-20.9zM16 18v-6'/>
			<path fill='currentColor' d='M17.5 22.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z'/>
		</svg>
	);
};

export default WarningIcon;
