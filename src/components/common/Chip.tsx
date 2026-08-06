import 'src/components/common/Chip.css';
import type { ReactElement, ReactNode } from 'react';

type ChipProps = {
	inputId: string;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	children: ReactNode;
};

const Chip = ({ inputId, leftIcon, rightIcon, children }: ChipProps): ReactElement => {
	return (
		<div className='chip'>
			{leftIcon && <label className='chip-icon chip-icon-left' htmlFor={inputId}>{leftIcon}</label>}
			<div className='chip-content'>
				{children}
			</div>
			{rightIcon && <span className='chip-icon chip-icon-right'>{rightIcon}</span>}
		</div>
	);
};

export { Chip };
