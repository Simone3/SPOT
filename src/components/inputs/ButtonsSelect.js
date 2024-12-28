import './ButtonsSelect.css';

const ButtonsSelect = ({ allowMultiSelect, options, selected, setSelected }) => {
	const onClickSingle = (key) => {
		if(selected !== key) {
			setSelected(key);
		}
	};

	const onClickMultiple = (event, key) => {
		const selectedIndex = selected.indexOf(key);
		if(event.metaKey || event.ctrlKey) {
			if(selectedIndex === -1) {
				// CTRL+click and user clicked on an unselected option: add that option to the array
				setSelected([ ...selected, key ]);
			}
			else {
				// CTRL+click and user clicked on a selected option: remove that option from the array
				setSelected(selected.toSpliced(selectedIndex, 1));
			}
		}
		else if(selectedIndex !== -1 && selected.length === 1) {
			// Simple click and user clicked the only selected option: reset to none
			setSelected([]);
		}
		else {
			// Simple click and user clicked either on an unselected option or on one of the selected options: that option gets selected
			setSelected([ key ]);
		}
	};

	return (
		<div className='buttons-select'>
			{options.map((option) => {
				const onClick = allowMultiSelect ? (event) => onClickMultiple(event, option.key) : () => onClickSingle(option.key);
				const isSelected = allowMultiSelect ? selected.includes(option.key) : selected === option.key;
				const extraStyle = isSelected && option.color ? { 'background-color': option.color } : undefined;
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
	);
};

export default ButtonsSelect;
