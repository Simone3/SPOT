import { useId, type MouseEvent, type ReactElement } from 'react';
import 'src/components/inputs/ButtonsSelect.css';
import Button from 'src/components/inputs/Button';

type ButtonsSelectOption = {
	key: string;
	value: string;
	label: string;
	color?: string;
};

type ButtonsSelectProps = {
	label?: string;
	allowMultiSelect?: boolean;
	options: ButtonsSelectOption[];
	value: string | string[];
	onChange: (value: string | string[]) => void;
};

const ButtonsSelect = ({ label, allowMultiSelect, options, value, onChange }: ButtonsSelectProps): ReactElement => {
	const id = useId();
	const onClickSingle = (optionValue: string): void => {
		if(value !== optionValue) {
			onChange(optionValue);
		}
	};

	const onClickMultiple = (event: MouseEvent<HTMLButtonElement>, optionValue: string): void => {
		const selectedValues = value as string[];
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
					const onClick = allowMultiSelect ?
						(event: MouseEvent<HTMLButtonElement>) => {
							return onClickMultiple(event, option.value);
						} :
						() => {
							return onClickSingle(option.value);
						};
					const isSelected = allowMultiSelect ? (value as string[]).includes(option.value) : value === option.value;
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
