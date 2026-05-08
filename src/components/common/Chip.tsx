import 'src/components/common/Chip.css';
import type { ReactElement, ReactNode } from 'react';

type ChipProps = {
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	children: ReactNode;
};

const Chip = ({ leftIcon, rightIcon, children }: ChipProps): ReactElement => {
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

export { Chip };
