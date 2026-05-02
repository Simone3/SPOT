import './Chip.css';
import type { ReactNode } from 'react';

type ChipProps = {
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	children: ReactNode;
};

const Chip = ({ leftIcon, rightIcon, children }: ChipProps) => {

	return (
		<div className='chip'>
			{leftIcon}
			<div className='chip-content'>
				{children}
			</div>
			{rightIcon}
		</div>
	);
};

export default Chip;
