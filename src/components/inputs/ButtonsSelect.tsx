import { useId, type MouseEvent, type ReactElement } from 'react';
import 'src/components/inputs/ButtonsSelect.css';
import { Button } from 'src/components/inputs/Button';

type ButtonsSelectOption = {
	key: string;
	value: string;
	label: string;
	color?: string;

	// How many things the option stands for, shown beside its label. "countLabel" is what the button is then called, because
	// reading a label and a bare number out does not say what the number counts, and "countColor" is what the number is tinted with.
	count?: number;
	countLabel?: string;
	countColor?: string;
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

					// A selected option is filled with the very colour the count would be tinted with, so the count is left to
					// take the colour of the label there and is tinted only while the option is unselected.
					const countStyle = !isSelected && option.countColor ? { color: option.countColor } : undefined;
					return (
						<Button
							key={option.key}
							onClick={onClick}
							className={`buttons-select-option ${isSelected ? 'buttons-select-option-selected' : 'buttons-select-option-unselected'}`}
							style={extraStyle}
							ariaLabel={option.count === undefined ? undefined : option.countLabel}
							label={
								<>
									{option.label}
									{option.count !== undefined &&
										<span className='buttons-select-option-count' style={countStyle}>{option.count}</span>
									}
								</>
							}
						/>
					);
				})}
			</div>
		</div>
	);
};

export { ButtonsSelect };
