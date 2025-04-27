import { useId } from 'react';
import './ButtonsSelect.css';

const ButtonsSelect = ({ label, allowMultiSelect, options, value, onChange }) => {
	const id = useId();
	const onClickSingle = (optionValue) => {
		if(value !== optionValue) {
			onChange(optionValue);
		}
	};

	const onClickMultiple = (event, optionValue) => {
		const selectedIndex = value.indexOf(optionValue);
		if(event.metaKey || event.ctrlKey) {
			if(selectedIndex === -1) {
				// CTRL+click and user clicked on an unselected option: add that option to the array
				onChange([ ...value, optionValue ]);
			}
			else {
				// CTRL+click and user clicked on a selected option: remove that option from the array
				onChange(value.toSpliced(selectedIndex, 1));
			}
		}
		else if(selectedIndex !== -1 && value.length === 1) {
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
					const onClick = allowMultiSelect ? (event) => onClickMultiple(event, option.value) : () => onClickSingle(option.value);
					const isSelected = allowMultiSelect ? value.includes(option.value) : value === option.value;
					const extraStyle = isSelected && option.color ? { backgroundColor: option.color } : undefined;
					return (
						<button
							key={option.key}
							onClick={onClick}
							className={`buttons-select-option ${isSelected ? 'buttons-select-option-selected' : 'buttons-select-option-unselected'}`}
							style={extraStyle}>
							{option.label}
						</button>
					);
				})}
			</div>
		</div>
	);
};

export default ButtonsSelect;
