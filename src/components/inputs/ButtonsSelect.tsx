import { useId, type MouseEvent } from 'react';
import './ButtonsSelect.css';
import Button from './Button';

type ButtonsSelectOption<TValue> = {
	key: string;
	value: TValue;
	label: string;
	color?: string;
};

type ButtonsSelectProps<TValue> = {
	label?: string;
	allowMultiSelect?: boolean;
	options: ButtonsSelectOption<TValue>[];
	value: TValue | TValue[];
	onChange: (value: TValue | TValue[]) => void;
};

const ButtonsSelect = <TValue, >({ label, allowMultiSelect, options, value, onChange }: ButtonsSelectProps<TValue>) => {
	const id = useId();
	const onClickSingle = (optionValue: TValue) => {
		if(value !== optionValue) {
			onChange(optionValue);
		}
	};

	const onClickMultiple = (event: MouseEvent<HTMLButtonElement>, optionValue: TValue) => {
		const selectedValues = value as TValue[];
		const selectedIndex = selectedValues.indexOf(optionValue);
		if(event.metaKey || event.ctrlKey) {
			if(selectedIndex === -1) {
				// CTRL+click and user clicked on an unselected option: add that option to the array
				onChange([ ...selectedValues, optionValue ]);
			}
			else {
				// CTRL+click and user clicked on a selected option: remove that option from the array
				onChange([ ...selectedValues.slice(0, selectedIndex), ...selectedValues.slice(selectedIndex + 1) ]);
			}
		}
		else if(selectedIndex !== -1 && selectedValues.length === 1) {
			// Simple click and user clicked the only selected option: reset to none
			onChange([]);
		}
		else {
			// Simple click and user clicked either on an unselected option or on one of the selected options: that option gets selected
			onChange([ optionValue ]);
		}
	};

	return (
		<div className='buttons-select-container'>
			{label && <label htmlFor={id} className='buttons-select-label'>{label}</label>}
			<div id={id} className='buttons-select-options'>
				{options.map((option) => {
					const onClick = allowMultiSelect ? (event: MouseEvent<HTMLButtonElement>) => onClickMultiple(event, option.value) : () => onClickSingle(option.value);
					const isSelected = allowMultiSelect ? (value as TValue[]).includes(option.value) : value === option.value;
					const extraStyle = isSelected && option.color ? { backgroundColor: option.color } : undefined;
					return (
						<Button
							key={option.key}
							onClick={onClick}
							className={`buttons-select-option ${isSelected ? 'buttons-select-option-selected' : 'buttons-select-option-unselected'}`}
							style={extraStyle}
							label={option.label}
						/>
					);
				})}
			</div>
		</div>
	);
};

export default ButtonsSelect;
